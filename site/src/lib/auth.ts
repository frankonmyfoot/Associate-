/**
 * Built-in email+password auth (Clerk replacement — works with ZERO env vars).
 *
 * Server-only module. Sessions are DB-backed: a random 32-byte token lives in
 * an httpOnly cookie, only its SHA-256 hash is stored (a stolen DB dump can't
 * produce valid cookies). Passwords use Node crypto scrypt with a random salt
 * and timing-safe comparison — no external services, nothing to configure.
 *
 * Cookie helpers come from @tanstack/react-start/server, which applies them to
 * the server-function response. `secure` follows x-forwarded-proto so the
 * proxy-served https environments always get a Secure cookie while plain-http
 * local testing still works.
 */

import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  deleteCookie,
  getCookie,
  getRequestHeader,
  setCookie,
} from "@tanstack/react-start/server";

import { ensureSchema, esc, execute, generateId, query } from "~/lib/db";

export const SESSION_COOKIE = "aa_session";
const SESSION_DAYS = 30;

// ─── Password hashing (scrypt) ────────────────────────────────

/** Returns `scrypt:<salt>:<hash>` (hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/** Constant-time password check against a stored `scrypt:...` hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = String(stored).split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  try {
    const computed = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return (
      computed.length === expected.length && timingSafeEqual(computed, expected)
    );
  } catch {
    return false;
  }
}

// ─── Session tokens ───────────────────────────────────────────

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getRequestHeader("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

/**
 * Creates a DB-backed session row and sets the httpOnly cookie. Returns the
 * raw token (already in the cookie — the DB only ever sees its hash).
 */
export async function startSession(userId: string): Promise<string> {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  await execute(
    // Opportunistic cleanup of expired rows so the table stays small.
    `DELETE FROM sessions WHERE expires_at < datetime('now')`,
  );
  await execute(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES ('${generateId()}', '${esc(userId)}', '${esc(tokenHash(token))}', datetime('now', '+${SESSION_DAYS} days'))`,
  );
  setCookie(SESSION_COOKIE, token, cookieOptions());
  return token;
}

/** Deletes the current session row and clears the cookie. */
export async function endSession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    try {
      await execute(
        `DELETE FROM sessions WHERE token_hash = '${esc(tokenHash(token))}'`,
      );
    } catch {
      // Session row is best-effort; clearing the cookie is what matters.
    }
  }
  deleteCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getRequestHeader("x-forwarded-proto") === "https",
    path: "/",
  });
}

export interface SessionUserRow {
  id: string;
  email: string;
  name: string;
  firm_id: string | null;
  role: string;
  expires_at: string;
}

/**
 * Resolves the signed-in user from the session cookie, joining the firm link.
 * Returns null when signed out, the cookie is missing, or the session expired.
 */
export async function getSessionUserRow(): Promise<SessionUserRow | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token || token.length < 32) return null;
  await ensureSchema();
  const rows = await query<SessionUserRow>(
    `SELECT u.id, u.email, u.name, u.firm_id, u.role, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = '${esc(tokenHash(token))}' AND s.expires_at > datetime('now')
     LIMIT 1`,
  );
  return rows[0] ?? null;
}
