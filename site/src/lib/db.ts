/**
 * Low-level database client — team-db CLI as the DB layer (per the lead's
 * direction; designed for a later PostgreSQL migration).
 *
 * The team-db CLI takes ONE SQL statement per invocation as a single argument
 * and prints JSON rows. We spawn it with a real argv array (no shell), so SQL
 * containing quotes/newlines is passed through verbatim and shell injection is
 * structurally impossible. SQLite string-literal injection is still on the
 * caller: interpolate user-controlled text ONLY through `esc()`.
 *
 * The `firms` / `firm_users` / `intake_forms` / `intake_submissions` /
 * `document_drafts` tables already exist in the shared DB; `ensureSchema()`
 * runs idempotent `CREATE TABLE IF NOT EXISTS` once per process so a fresh
 * database also works.
 */

const CMD = "team-db";
const TIMEOUT_MS = 20_000;

export interface DbResult {
  [key: string]: unknown;
}

async function run(sql: string): Promise<string> {
  const proc = Bun.spawn([CMD, sql], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: TIMEOUT_MS,
  });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`team-db failed (exit ${code}): ${err.trim().slice(0, 300)}`);
  }
  return out;
}

/** Execute a read query; returns the parsed rows. */
export async function query<T extends DbResult = DbResult>(
  sql: string,
): Promise<T[]> {
  const out = await run(sql);
  const parsed: unknown = JSON.parse(out);
  if (!Array.isArray(parsed)) {
    throw new Error(`team-db returned non-array output: ${out.slice(0, 120)}`);
  }
  return parsed as T[];
}

/** Execute a write query (INSERT / UPDATE / DELETE / CREATE TABLE). */
export async function execute(sql: string): Promise<void> {
  await run(sql);
}

/** Escape a value for interpolation into a SQLite string literal. */
export function esc(value: string): string {
  return value.replace(/'/g, "''");
}

/** Quote a value as a SQLite string literal ('' for NULL). */
export function lit(value: string | null | undefined): string {
  return value == null ? "NULL" : `'${esc(value)}'`;
}

/** Validate an integer-ish param; returns its SQL literal or NULL. */
export function intLit(value: number | string | null | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : "NULL";
}

export function generateId(): string {
  return crypto.randomUUID();
}

// ─── Schema bootstrap (idempotent) ────────────────────────────

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS firms (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, plan TEXT NOT NULL DEFAULT 'starter', practice_areas TEXT, team_size INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS firm_users (id TEXT PRIMARY KEY, firm_id TEXT NOT NULL REFERENCES firms(id), clerk_user_id TEXT NOT NULL UNIQUE, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'attorney' CHECK(role IN ('admin','attorney','paralegal','staff')), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS intake_forms (id TEXT PRIMARY KEY, firm_id TEXT NOT NULL REFERENCES firms(id), title TEXT NOT NULL, description TEXT, fields TEXT NOT NULL DEFAULT '[]', is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS intake_submissions (id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES intake_forms(id), firm_id TEXT NOT NULL REFERENCES firms(id), data TEXT NOT NULL DEFAULT '{}', case_summary TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','archived')), created_at TEXT NOT NULL DEFAULT (datetime('now')), reviewed_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS document_drafts (id TEXT PRIMARY KEY, firm_id TEXT NOT NULL REFERENCES firms(id), title TEXT NOT NULL, document_type TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', case_details TEXT, source_submission_id TEXT REFERENCES intake_submissions(id), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','finalized','archived')), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
];

let schemaPromise: Promise<void> | null = null;

/** Runs the idempotent schema once per process; safe to await before any query. */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const stmt of SCHEMA_STATEMENTS) {
        await execute(stmt);
      }
    })().catch((err) => {
      schemaPromise = null; // allow retry after a transient failure
      throw err;
    });
  }
  return schemaPromise;
}
