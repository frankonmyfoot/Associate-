/**
 * Server layer for the AssociateAI product (ported from the Next.js MVP).
 *
 * All server logic lives in `createServerFn()` handlers — TanStack Start's
 * supported server-logic pattern in this version (file-based API routes no
 * longer exist here; only the health endpoint is a raw path, intercepted in
 * serve.ts). Auth is built-in email+password (see src/lib/auth.ts): the
 * session cookie holds a random token, the DB stores only its hash. There are
 * no auth env vars — sign-up/sign-in work the moment this deploys.
 *
 * DB: team-db CLI via src/lib/db.ts. One SQL statement per team-db call —
 * aggregate reads are consolidated into single statements with scalar
 * subqueries so pages need 2-3 CLI round trips, not one per count.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import {
  ensureSchema,
  esc,
  execute,
  generateId,
  intLit,
  lit,
  query,
} from "~/lib/db";
import {
  endSession,
  getSessionUserRow,
  hashPassword,
  startSession,
  verifyPassword,
} from "~/lib/auth";
import {
  generateDocument,
  generateIntakeSummary,
  pingOpenAi,
} from "~/lib/ai";
import { getDocumentType } from "~/lib/documents";
import {
  billingConfigured,
  createCheckoutSession,
  createPortalSession,
  priceIdFor,
  type PurchasablePlan,
} from "~/lib/billing";
import { PLANS, type PlanId } from "~/lib/plans";
import type { DocumentType, IntakeField, IntakeFieldType } from "~/lib/types";

// ─── Auth (built-in email+password sessions) ──────────────────

async function currentUserId(): Promise<string | null> {
  const user = await getSessionUserRow();
  return user?.id ?? null;
}

// ─── Small helpers ────────────────────────────────────────────

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

const FIELD_TYPES: IntakeFieldType[] = [
  "text",
  "textarea",
  "date",
  "file",
  "select",
  "email",
  "phone",
];

function validFields(input: unknown): IntakeField[] {
  if (!Array.isArray(input)) return [];
  const fields: IntakeField[] = [];
  for (const raw of input.slice(0, 50)) {
    const f = raw as Partial<IntakeField>;
    const type = FIELD_TYPES.includes(f.type as IntakeFieldType)
      ? (f.type as IntakeFieldType)
      : "text";
    const label = text(f.label).slice(0, 200);
    if (!label) continue;
    fields.push({
      id: text(f.id).slice(0, 60) || `field_${generateId()}`,
      type,
      label,
      placeholder: text(f.placeholder).slice(0, 200) || undefined,
      required: Boolean(f.required),
      options:
        type === "select"
          ? (Array.isArray(f.options) ? f.options : [])
              .map((o) => text(o).slice(0, 120))
              .filter((o) => o.trim())
              .slice(0, 30)
          : undefined,
    });
  }
  return fields;
}

function generateCaseSummary(
  data: Record<string, string>,
  fields: IntakeField[],
): string {
  const nameField = fields.find(
    (f) => f.type === "text" && /name|full.?name|client.?name/i.test(f.label),
  );
  const emailField = fields.find(
    (f) => f.type === "email" || (f.type === "text" && /email/i.test(f.label)),
  );
  const phoneField = fields.find(
    (f) =>
      f.type === "phone" ||
      (f.type === "text" && /phone|telephone/i.test(f.label)),
  );
  const descField = fields.find(
    (f) =>
      f.type === "textarea" &&
      /describe|details|explain|description/i.test(f.label),
  );

  const parts: string[] = [];
  if (nameField && data[nameField.id])
    parts.push(`Client: ${data[nameField.id]}`);
  if (emailField && data[emailField.id])
    parts.push(`Email: ${data[emailField.id]}`);
  if (phoneField && data[phoneField.id])
    parts.push(`Phone: ${data[phoneField.id]}`);
  if (descField && data[descField.id]) {
    const desc = data[descField.id];
    parts.push(
      `Details: ${desc.length > 100 ? desc.substring(0, 100) + "..." : desc}`,
    );
  }

  return parts.length > 0 ? parts.join(" | ") : "Submitted via intake form";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Auth server functions ────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  firmId: string | null;
  role: string;
}

/** Resolves the signed-in user for the current request; null when signed out. */
export const getSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const user = await getSessionUserRow();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firmId: user.firm_id,
      role: user.role,
    };
  },
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates the account + the firm workspace (billing fields null, plan
 * defaults to 'starter'), starts the session, and hands the client off to
 * onboarding — which then fills in the firm's details.
 */
export const signUp = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) => input as { email?: string; password?: string; name?: string },
  )
  .handler(async ({ data }) => {
    await ensureSchema();
    const email = (data.email ?? "").trim().toLowerCase();
    const password = data.password ?? "";
    const name = (data.name ?? "").trim().slice(0, 200);
    if (!EMAIL_RE.test(email))
      throw new Error("Enter a valid email address.");
    if (password.length < 8)
      throw new Error("Password must be at least 8 characters.");
    if (password.length > 200) throw new Error("Password is too long.");

    // The UNIQUE index on email is the duplicate guard — no pre-check race.
    const userId = generateId();
    try {
      await execute(
        `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
         VALUES ('${userId}', '${esc(email)}', '${esc(hashPassword(password))}', '${esc(name || email.split("@")[0] || "Firm Admin")}', 'admin', datetime('now'), datetime('now'))`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE/i.test(msg))
        throw new Error(
          "An account with this email already exists — sign in instead.",
        );
      throw new Error("Could not create the account. Please try again.");
    }

    // Provision the firm right away so the dashboard has a workspace; the
    // onboarding wizard renames it with the details collected there.
    const firmId = generateId();
    const slug = `firm-${generateId().slice(0, 12)}`;
    await execute(
      `INSERT INTO firms (id, name, slug, created_at, updated_at)
       VALUES ('${firmId}', 'New Firm', '${esc(slug)}', datetime('now'), datetime('now'))`,
    );
    await execute(
      `UPDATE users SET firm_id = '${firmId}' WHERE id = '${userId}'`,
    );

    await startSession(userId);
    return { ok: true as const, redirect: "/onboarding" as const };
  });

export const signIn = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { email?: string; password?: string })
  .handler(async ({ data }) => {
    await ensureSchema();
    const email = (data.email ?? "").trim().toLowerCase();
    const password = data.password ?? "";
    const rows = await query<{
      id: string;
      password_hash: string;
      firm_id: string | null;
    }>(
      `SELECT id, password_hash, firm_id FROM users WHERE email = '${esc(email)}' LIMIT 1`,
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new Error("Email or password is incorrect.");
    }
    await startSession(user.id);
    return {
      ok: true as const,
      redirect: (user.firm_id ? "/dashboard" : "/onboarding") as
        | "/dashboard"
        | "/onboarding",
    };
  });

export const signOut = createServerFn({ method: "POST" }).handler(
  async () => {
    await endSession();
    return { ok: true as const, redirect: "/" as const };
  },
);

// ─── Firm resolution ──────────────────────────────────────────

async function firmForUser(userId: string) {
  const rows = await query<{
    id: string;
    name: string;
    plan: string;
    slug: string;
    stripe_customer_id: string | null;
    subscription_status: string | null;
    current_period_end: string | null;
  }>(
    `SELECT f.id, f.name, f.plan, f.slug, f.stripe_customer_id, f.subscription_status, f.current_period_end
     FROM firms f
     JOIN users u ON u.firm_id = f.id
     WHERE u.id = '${esc(userId)}' LIMIT 1`,
  );
  return rows[0] ?? null;
}

// ─── BYO OpenAI key ───────────────────────────────────────────

function maskKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

/**
 * Effective OpenAI key for a firm: the firm's own BYO key first, then the
 * platform OPENAI_API_KEY env var. Null when neither exists (template
 * fallback kicks in).
 */
async function resolveOpenAiKey(firmId: string): Promise<string | null> {
  const rows = await query<{ k: string | null }>(
    `SELECT openai_api_key AS k FROM firms WHERE id = '${esc(firmId)}' LIMIT 1`,
  );
  const byo = rows[0]?.k?.trim();
  if (byo) return byo;
  const envKey = process.env.OPENAI_API_KEY?.trim();
  return envKey || null;
}

/** Stores the firm's own OpenAI API key (server-side only, never returned raw). */
export const saveOpenAiKey = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { apiKey?: string })
  .handler(async ({ data }) => {
    const user = await getSessionUserRow();
    const firm = user?.firm_id ? await firmForUser(user.id) : null;
    if (!firm) throw new Error("Complete onboarding first.");
    const apiKey = (data.apiKey ?? "").trim();
    if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey))
      throw new Error(
        "That doesn't look like an OpenAI API key — keys start with 'sk-'.",
      );
    await execute(
      `UPDATE firms SET openai_api_key = '${esc(apiKey)}', updated_at = datetime('now') WHERE id = '${esc(firm.id)}'`,
    );
    return { ok: true as const, maskedKey: maskKey(apiKey) };
  });

/** Clears the firm's BYO OpenAI key. */
export const clearOpenAiKey = createServerFn({ method: "POST" }).handler(
  async () => {
    const user = await getSessionUserRow();
    const firm = user?.firm_id ? await firmForUser(user.id) : null;
    if (!firm) throw new Error("Complete onboarding first.");
    await execute(
      `UPDATE firms SET openai_api_key = NULL, updated_at = datetime('now') WHERE id = '${esc(firm.id)}'`,
    );
    return { ok: true as const };
  },
);

/** 1-token ping against the effective key (BYO first, else platform env). */
export const testOpenAiKey = createServerFn({ method: "POST" }).handler(
  async () => {
    const user = await getSessionUserRow();
    const firm = user?.firm_id ? await firmForUser(user.id) : null;
    if (!firm) throw new Error("Complete onboarding first.");
    const key = await resolveOpenAiKey(firm.id);
    if (!key) {
      return {
        ok: false as const,
        message:
          "Nothing to test yet — save your firm's OpenAI API key first (no platform key is configured either).",
      };
    }
    return pingOpenAi(key);
  },
);

// ─── Plan gating ─────────────────────────────────────────────

type LimitKind = "users" | "intakeSubmissions" | "documentGenerations";

const UPGRADE_HINT = "View plans at /pricing or ask your firm admin to upgrade.";

/**
 * Enforces the firm's plan limits (read from the firm record, not the session).
 * Throws a friendly, user-facing message — never a raw error/stack. Pro (and
 * Enterprise) are unlimited; Starter: 3 users, 100 intakes/mo, 50 docs/mo.
 */
async function assertWithinPlanLimit(
  firm: { id: string; plan: string },
  kind: LimitKind,
): Promise<void> {
  const plan = PLANS[firm.plan as PlanId] ?? PLANS.starter;
  const limit =
    kind === "users"
      ? plan.limits.users
      : kind === "intakeSubmissions"
        ? plan.limits.intakeSubmissionsPerMonth
        : plan.limits.documentGenerationsPerMonth;
  if (limit === -1) return; // unlimited

  let used: number;
  if (kind === "users") {
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM users WHERE firm_id = '${esc(firm.id)}'`,
    );
    used = Number(rows[0]?.count ?? 0);
  } else {
    const table = kind === "intakeSubmissions" ? "intake_submissions" : "document_drafts";
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${table}
       WHERE firm_id = '${esc(firm.id)}' AND substr(created_at, 1, 7) = substr(datetime('now'), 1, 7)`,
    );
    used = Number(rows[0]?.count ?? 0);
  }

  if (used >= limit) {
    const what =
      kind === "users"
        ? "team members"
        : kind === "intakeSubmissions"
          ? "monthly intake submissions"
          : "monthly document generations";
    throw new Error(
      `Your firm is on the ${plan.name} plan and has used all ${limit} ${what} this month. ${UPGRADE_HINT}`,
    );
  }
}

export interface DashboardAuthState {
  mode: "signed-out" | "no-firm" | "ok";
  firmName?: string;
  userName?: string;
  userEmail?: string;
}

export const getDashboardAuthState = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardAuthState> => {
  await ensureSchema();
  const user = await getSessionUserRow();
  if (!user) {
    return { mode: "signed-out" };
  }
  if (!user.firm_id) {
    return { mode: "no-firm", userName: user.name, userEmail: user.email };
  }
  const firmRows = await query<{ name: string }>(
    `SELECT name FROM firms WHERE id = '${esc(user.firm_id)}' LIMIT 1`,
  );
  return {
    mode: "ok",
    firmName: firmRows[0]?.name ?? "My Firm",
    userName: user.name,
    userEmail: user.email,
  };
});

export const onboardFirm = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as {
        firmName: string;
        practiceAreas?: string;
        teamSize?: string;
      },
  )
  .handler(async ({ data }) => {
    await ensureSchema();
    const user = await getSessionUserRow();
    if (!user) {
      throw new Error(
        "Please sign in first — create an account, then complete onboarding.",
      );
    }
    const firmName = (data.firmName ?? "").trim().slice(0, 200);
    if (!firmName) throw new Error("Firm name is required");

    const practiceAreas = (data.practiceAreas ?? "").trim().slice(0, 2000);
    const teamSizeRaw = (data.teamSize ?? "").trim();
    const teamSizeNum = teamSizeRaw.startsWith("2")
      ? 3
      : teamSizeRaw.startsWith("6")
        ? 10
        : teamSizeRaw.startsWith("16")
          ? 25
          : teamSizeRaw.startsWith("50")
            ? 60
            : teamSizeRaw === "1"
              ? 1
              : null;

    // Sign-up already provisioned the firm workspace — the wizard fills in
    // the details on the existing firm record.
    if (user.firm_id) {
      await execute(
        `UPDATE firms SET name = '${esc(firmName)}', practice_areas = ${lit(practiceAreas || null)}, team_size = ${teamSizeNum == null ? "NULL" : String(teamSizeNum)}, updated_at = datetime('now')
         WHERE id = '${esc(user.firm_id)}'`,
      );
      return { firmId: user.firm_id };
    }

    // Safety net: a user without a firm (shouldn't happen with sign-up
    // provisioning) still gets one created and linked here.
    const baseSlug = slugify(firmName) || "firm";
    let slug = baseSlug;
    let firmId = generateId();
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await execute(
          `INSERT INTO firms (id, name, slug, practice_areas, team_size, created_at, updated_at)
           VALUES ('${firmId}', '${esc(firmName)}', '${esc(slug)}', ${lit(practiceAreas || null)}, ${teamSizeNum == null ? "NULL" : String(teamSizeNum)}, datetime('now'), datetime('now'))`,
        );
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/UNIQUE/.test(msg) && attempt < 3) {
          slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
          firmId = generateId();
          continue;
        }
        throw new Error(`Could not create firm: ${msg.slice(0, 200)}`);
      }
    }

    await execute(
      `UPDATE users SET firm_id = '${firmId}', role = 'admin' WHERE id = '${esc(user.id)}'`,
    );

    return { firmId, slug };
  });

// ─── Dashboard stats ──────────────────────────────────────────

export interface DashboardStats {
  mode: "ok" | "no-firm";
  counts: {
    intakeForms: number;
    pendingIntakes: number;
    reviewedIntakes: number;
    draftDocs: number;
    finalizedDocs: number;
  };
  recentSubmissions: Array<{
    id: string;
    formId: string;
    summary: string;
    status: string;
    createdAt: string;
  }>;
  recentDocs: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
}

export const getDashboardStats = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardStats> => {
  const userId = await currentUserId();
  const firm = userId ? await firmForUser(userId) : null;
  if (!firm) return { mode: "no-firm", counts: { intakeForms: 0, pendingIntakes: 0, reviewedIntakes: 0, draftDocs: 0, finalizedDocs: 0 }, recentSubmissions: [], recentDocs: [] };
  const firmId = firm.id;

  const countRows = await query<Record<string, unknown>>(
    `SELECT
       (SELECT COUNT(*) FROM intake_forms WHERE firm_id = '${esc(firmId)}') AS intake_forms,
       (SELECT COUNT(*) FROM intake_submissions WHERE firm_id = '${esc(firmId)}' AND status = 'pending') AS pending_intakes,
       (SELECT COUNT(*) FROM intake_submissions WHERE firm_id = '${esc(firmId)}' AND status = 'reviewed') AS reviewed_intakes,
       (SELECT COUNT(*) FROM document_drafts WHERE firm_id = '${esc(firmId)}' AND status = 'draft') AS draft_docs,
       (SELECT COUNT(*) FROM document_drafts WHERE firm_id = '${esc(firmId)}' AND status = 'finalized') AS finalized_docs`,
  );
  const c = countRows[0] ?? {};

  const subs = await query<Record<string, unknown>>(
    `SELECT id, form_id, case_summary, status, created_at FROM intake_submissions
     WHERE firm_id = '${esc(firmId)}' ORDER BY created_at DESC LIMIT 5`,
  );
  const docs = await query<Record<string, unknown>>(
    `SELECT id, title, status, created_at FROM document_drafts
     WHERE firm_id = '${esc(firmId)}' ORDER BY created_at DESC LIMIT 5`,
  );

  return {
    mode: "ok",
    counts: {
      intakeForms: Number(c.intake_forms ?? 0),
      pendingIntakes: Number(c.pending_intakes ?? 0),
      reviewedIntakes: Number(c.reviewed_intakes ?? 0),
      draftDocs: Number(c.draft_docs ?? 0),
      finalizedDocs: Number(c.finalized_docs ?? 0),
    },
    recentSubmissions: subs.map((s) => ({
      id: text(s.id),
      formId: text(s.form_id),
      summary: text(s.case_summary) || "Submission",
      status: text(s.status),
      createdAt: text(s.created_at),
    })),
    recentDocs: docs.map((d) => ({
      id: text(d.id),
      title: text(d.title) || "Untitled",
      status: text(d.status),
      createdAt: text(d.created_at),
    })),
  };
});

// ─── Intake forms ─────────────────────────────────────────────

export const listIntakeForms = createServerFn({ method: "GET" }).handler(
  async () => {
    await ensureSchema();
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) return { mode: "no-firm" as const, forms: [] };
    const rows = await query<Record<string, unknown>>(
      `SELECT f.id, f.title, f.description, f.fields, f.is_active, f.created_at,
              (SELECT COUNT(*) FROM intake_submissions s WHERE s.form_id = f.id) AS submission_count
       FROM intake_forms f WHERE f.firm_id = '${esc(firm.id)}' ORDER BY f.created_at DESC`,
    );
    return {
      mode: "ok" as const,
      forms: rows.map((r) => ({
        id: text(r.id),
        title: text(r.title),
        description: text(r.description) || "",
        fieldCount: parseJson<IntakeField[]>(r.fields, []).length,
        submissionCount: Number(r.submission_count ?? 0),
        isActive: Number(r.is_active ?? 0) === 1,
        createdAt: text(r.created_at),
      })),
    };
  },
);

export const createIntakeForm = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as { title: string; description?: string; fields: unknown },
  )
  .handler(async ({ data }) => {
    await ensureSchema();
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) throw new Error("Please sign in to create intake forms.");

    const title = (data.title ?? "").trim().slice(0, 300);
    if (!title) throw new Error("Form title is required");
    const fields = validFields(data.fields);
    if (fields.length === 0) throw new Error("Add at least one field");
    if (fields.some((f) => !f.label.trim()))
      throw new Error("All fields must have a label");

    const id = generateId();
    const description = (data.description ?? "").trim().slice(0, 1000);
    await execute(
      `INSERT INTO intake_forms (id, firm_id, title, description, fields, is_active, created_at, updated_at)
       VALUES ('${id}', '${esc(firm.id)}', '${esc(title)}', ${lit(description || null)}, '${esc(JSON.stringify(fields))}', 1, datetime('now'), datetime('now'))`,
    );
    return { id };
  });

export interface FormDetail {
  mode: "ok" | "not-found" | "no-firm";
  form: {
    id: string;
    title: string;
    description: string;
    fields: IntakeField[];
    isActive: boolean;
  };
  submissions: Array<{
    id: string;
    summary: string;
    status: string;
    createdAt: string;
  }>;
  shareUrl: string;
}

export const getIntakeFormDetail = createServerFn({ method: "GET" })
  .validator((input: unknown) => input as { formId: string })
  .handler(async ({ data }): Promise<FormDetail> => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm)
      return {
        mode: "no-firm",
        form: { id: "", title: "", description: "", fields: [], isActive: false },
        submissions: [],
        shareUrl: "",
      };
    const forms = await query<Record<string, unknown>>(
      `SELECT * FROM intake_forms WHERE id = '${esc(data.formId)}' AND firm_id = '${esc(firm.id)}'`,
    );
    if (!forms.length)
      return {
        mode: "not-found",
        form: { id: "", title: "", description: "", fields: [], isActive: false },
        submissions: [],
        shareUrl: "",
      };
    const form = forms[0];
    const fields = parseJson<IntakeField[]>(form.fields, []);
    const subs = await query<Record<string, unknown>>(
      `SELECT id, case_summary, status, created_at FROM intake_submissions
       WHERE form_id = '${esc(data.formId)}' ORDER BY created_at DESC`,
    );
    const origin = requestOrigin();
    return {
      mode: "ok",
      form: {
        id: text(form.id),
        title: text(form.title),
        description: text(form.description),
        fields,
        isActive: Number(form.is_active ?? 0) === 1,
      },
      submissions: subs.map((s) => ({
        id: text(s.id),
        summary: text(s.case_summary) || "Submission",
        status: text(s.status),
        createdAt: text(s.created_at),
      })),
      shareUrl: `${origin}/intake/${text(form.id)}`,
    };
  });

// ─── Public intake (no auth — client-facing form) ─────────────

export const getPublicIntakeForm = createServerFn({ method: "GET" })
  .validator((input: unknown) => input as { formId: string })
  .handler(async ({ data }) => {
    await ensureSchema();
    const forms = await query<Record<string, unknown>>(
      `SELECT f.id, f.title, f.description, f.fields, f.is_active, fi.name AS firm_name
       FROM intake_forms f JOIN firms fi ON fi.id = f.firm_id
       WHERE f.id = '${esc(data.formId)}'`,
    );
    if (!forms.length || Number(forms[0].is_active ?? 0) !== 1) {
      return { mode: "not-found" as const, title: "", description: "", fields: [], firmName: "" };
    }
    const f = forms[0];
    return {
      mode: "ok" as const,
      title: text(f.title),
      description: text(f.description),
      fields: parseJson<IntakeField[]>(f.fields, []),
      firmName: text(f.firm_name),
    };
  });

export const submitIntake = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) => input as { formId: string; data: Record<string, string> },
  )
  .handler(async ({ data }) => {
    await ensureSchema();
    const forms = await query<Record<string, unknown>>(
      `SELECT id, firm_id, fields FROM intake_forms WHERE id = '${esc(data.formId)}' AND is_active = 1`,
    );
    if (!forms.length)
      throw new Error("This intake form no longer exists or is inactive.");

    const fields = parseJson<IntakeField[]>(forms[0].fields, []);
    const firmId = text(forms[0].firm_id);

    // Plan gating (public flow: no pricing link in the message — the visitor
    // isn't a firm user; the firm sees the upgrade prompt in the dashboard).
    const firmRows = await query<{ plan: string }>(
      `SELECT plan FROM firms WHERE id = '${esc(firmId)}'`,
    );
    const limit =
      PLANS[(firmRows[0]?.plan as PlanId) ?? "starter"]?.limits
        .intakeSubmissionsPerMonth ?? -1;
    if (limit !== -1) {
      const used = await query<{ count: number }>(
        `SELECT COUNT(*) AS count FROM intake_submissions
         WHERE firm_id = '${esc(firmId)}' AND substr(created_at, 1, 7) = substr(datetime('now'), 1, 7)`,
      );
      if (Number(used[0]?.count ?? 0) >= limit) {
        throw new Error(
          `This firm has reached its plan's limit of ${limit} intake submissions this month. The form is temporarily paused — please contact the firm.`,
        );
      }
    }

    // Only accept values for known field ids; cap each value's size.
    const submittedData: Record<string, string> = {};
    for (const field of fields) {
      const value = text(data.data?.[field.id]).slice(0, 10_000);
      if (field.required && !value.trim()) {
        throw new Error(`Field "${field.label}" is required`);
      }
      if (value) submittedData[field.id] = value;
    }
    if (Object.keys(submittedData).length === 0) {
      throw new Error("No data submitted");
    }

    const id = generateId();
    const caseSummary = generateCaseSummary(submittedData, fields);
    // Prefer an AI-written summary (firm BYO key → platform key); the
    // deterministic summary above is the fallback so submissions never fail
    // because of the AI path.
    let finalSummary = caseSummary;
    try {
      const aiKey = await resolveOpenAiKey(firmId);
      if (aiKey) {
        const aiSummary = await generateIntakeSummary(
          aiKey,
          submittedData,
          fields,
        );
        if (aiSummary) finalSummary = aiSummary.slice(0, 4000);
      }
    } catch (err) {
      console.warn(
        "AI intake summary failed; keeping deterministic summary:",
        err instanceof Error ? err.message : err,
      );
    }
    await execute(
      `INSERT INTO intake_submissions (id, form_id, firm_id, data, case_summary, status, created_at)
       VALUES ('${id}', '${esc(data.formId)}', '${esc(firmId)}', '${esc(JSON.stringify(submittedData))}', '${esc(finalSummary)}', 'pending', datetime('now'))`,
    );
    return { id };
  });

export interface SubmissionDetail {
  mode: "ok" | "not-found" | "no-firm";
  submission: {
    id: string;
    formId: string;
    formTitle: string;
    data: Record<string, string>;
    caseSummary: string;
    status: string;
    createdAt: string;
  };
  fieldLabels: Record<string, string>;
}

export const getSubmission = createServerFn({ method: "GET" })
  .validator((input: unknown) => input as { submissionId: string })
  .handler(async ({ data }): Promise<SubmissionDetail> => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm)
      return {
        mode: "no-firm",
        submission: {
          id: "",
          formId: "",
          formTitle: "",
          data: {},
          caseSummary: "",
          status: "",
          createdAt: "",
        },
        fieldLabels: {},
      };
    const subs = await query<Record<string, unknown>>(
      `SELECT s.*, f.title AS form_title, f.fields AS form_fields
       FROM intake_submissions s JOIN intake_forms f ON f.id = s.form_id
       WHERE s.id = '${esc(data.submissionId)}' AND s.firm_id = '${esc(firm.id)}'`,
    );
    if (!subs.length)
      return {
        mode: "not-found",
        submission: {
          id: "",
          formId: "",
          formTitle: "",
          data: {},
          caseSummary: "",
          status: "",
          createdAt: "",
        },
        fieldLabels: {},
      };
    const s = subs[0];
    const fields = parseJson<IntakeField[]>(s.form_fields, []);
    const fieldLabels: Record<string, string> = {};
    for (const f of fields) fieldLabels[f.id] = f.label;
    return {
      mode: "ok",
      submission: {
        id: text(s.id),
        formId: text(s.form_id),
        formTitle: text(s.form_title),
        data: parseJson<Record<string, string>>(s.data, {}),
        caseSummary: text(s.case_summary),
        status: text(s.status),
        createdAt: text(s.created_at),
      },
      fieldLabels,
    };
  });

export const setSubmissionStatus = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) => input as { submissionId: string; status: string },
  )
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) throw new Error("Please sign in first.");
    if (!["pending", "reviewed", "archived"].includes(data.status)) {
      throw new Error("Invalid status");
    }
    await execute(
      `UPDATE intake_submissions SET status = '${esc(data.status)}',
         reviewed_at = ${data.status === "reviewed" ? "datetime('now')" : "reviewed_at"}
       WHERE id = '${esc(data.submissionId)}' AND firm_id = '${esc(firm.id)}'`,
    );
    return { ok: true };
  });

// ─── Documents ────────────────────────────────────────────────

export const listDocuments = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) return { mode: "no-firm" as const, docs: [] };
    const rows = await query<Record<string, unknown>>(
      `SELECT id, title, document_type, status, created_at, updated_at
       FROM document_drafts WHERE firm_id = '${esc(firm.id)}'
       ORDER BY updated_at DESC`,
    );
    return {
      mode: "ok" as const,
      docs: rows.map((r) => ({
        id: text(r.id),
        title: text(r.title) || "Untitled",
        documentType: text(r.document_type),
        status: text(r.status),
        createdAt: text(r.created_at),
        updatedAt: text(r.updated_at),
      })),
    };
  },
);

export const generateDocumentFn = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as { documentType: string; caseDetails: Record<string, string> },
  )
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Please sign in to generate documents.");
    const firm = await firmForUser(userId);
    if (!firm) throw new Error("Complete onboarding before generating documents.");
    await assertWithinPlanLimit(firm, "documentGenerations");
    if (!getDocumentType(data.documentType))
      throw new Error("Unknown document type");
    const caseDetails: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.caseDetails ?? {}).slice(0, 60)) {
      caseDetails[k.slice(0, 60)] = String(v).slice(0, 20_000);
    }
    if (Object.keys(caseDetails).length === 0)
      throw new Error("Case details are required");
    const openAiKey = await resolveOpenAiKey(firm.id);
    return generateDocument(
      {
        documentType: data.documentType as DocumentType,
        caseDetails,
      },
      { openAiKey },
    );
  });

export const saveDocument = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as {
        title: string;
        documentType: string;
        content: string;
        caseDetails?: Record<string, string>;
        sourceSubmissionId?: string;
      },
  )
  .handler(async ({ data }) => {
    await ensureSchema();
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) throw new Error("Please sign in to save documents.");
    await assertWithinPlanLimit(firm, "documentGenerations");
    if (!getDocumentType(data.documentType))
      throw new Error("Unknown document type");
    const id = generateId();
    await execute(
      `INSERT INTO document_drafts (id, firm_id, title, document_type, content, case_details, source_submission_id, status, created_at, updated_at)
       VALUES ('${id}', '${esc(firm.id)}', ${lit((data.title || "Untitled").slice(0, 300))}, '${esc(data.documentType)}', ${lit((data.content || "").slice(0, 500_000))}, '${esc(JSON.stringify(data.caseDetails ?? {}))}', ${lit(data.sourceSubmissionId?.slice(0, 60) || null)}, 'draft', datetime('now'), datetime('now'))`,
    );
    return { id };
  });

export interface DocumentDetail {
  mode: "ok" | "not-found" | "no-firm";
  doc: {
    id: string;
    title: string;
    documentType: string;
    content: string;
    caseDetails: Record<string, string>;
    status: string;
    createdAt: string;
  };
}

export const getDocument = createServerFn({ method: "GET" })
  .validator((input: unknown) => input as { docId: string })
  .handler(async ({ data }): Promise<DocumentDetail> => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm)
      return {
        mode: "no-firm",
        doc: {
          id: "",
          title: "",
          documentType: "",
          content: "",
          caseDetails: {},
          status: "",
          createdAt: "",
        },
      };
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM document_drafts WHERE id = '${esc(data.docId)}' AND firm_id = '${esc(firm.id)}'`,
    );
    if (!rows.length)
      return {
        mode: "not-found",
        doc: {
          id: "",
          title: "",
          documentType: "",
          content: "",
          caseDetails: {},
          status: "",
          createdAt: "",
        },
      };
    const d = rows[0];
    return {
      mode: "ok",
      doc: {
        id: text(d.id),
        title: text(d.title) || "Untitled",
        documentType: text(d.document_type),
        content: text(d.content),
        caseDetails: parseJson<Record<string, string>>(d.case_details, {}),
        status: text(d.status),
        createdAt: text(d.created_at),
      },
    };
  });

export const updateDocument = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as {
        docId: string;
        title?: string;
        content?: string;
        status?: string;
      },
  )
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) throw new Error("Please sign in first.");
    if (
      data.status &&
      !["draft", "finalized", "archived"].includes(data.status)
    ) {
      throw new Error("Invalid status");
    }
    const sets: string[] = ["updated_at = datetime('now')"];
    if (data.title != null) sets.push(`title = ${lit(data.title.slice(0, 300))}`);
    if (data.content != null)
      sets.push(`content = ${lit(data.content.slice(0, 500_000))}`);
    if (data.status) sets.push(`status = '${esc(data.status)}'`);
    await execute(
      `UPDATE document_drafts SET ${sets.join(", ")}
       WHERE id = '${esc(data.docId)}' AND firm_id = '${esc(firm.id)}'`,
    );
    return { ok: true };
  });

// ─── Settings ─────────────────────────────────────────────────

export const getSettingsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) return { mode: "no-firm" as const };
    const firmRows = await query<Record<string, unknown>>(
      `SELECT * FROM firms WHERE id = '${esc(firm.id)}'`,
    );
    const f = firmRows[0] ?? {};
    const members = await query<Record<string, unknown>>(
      `SELECT id, email, name, role, created_at FROM users
       WHERE firm_id = '${esc(firm.id)}' ORDER BY created_at ASC`,
    );
    const countRows = await query<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM intake_submissions WHERE firm_id = '${esc(firm.id)}') AS intakes,
         (SELECT COUNT(*) FROM document_drafts WHERE firm_id = '${esc(firm.id)}') AS docs`,
    );
    return {
      mode: "ok" as const,
      firm: {
        name: text(f.name),
        plan: text(f.plan) || "starter",
        practiceAreas: text(f.practice_areas),
        teamSize: f.team_size == null ? "" : String(f.team_size),
        firmId: text(f.id),
      },
      billing: {
        stripeConfigured: billingConfigured().configured,
        stripeCustomerId: text(f.stripe_customer_id),
        subscriptionStatus: text(f.subscription_status),
        currentPeriodEnd: text(f.current_period_end),
      },
      ai: {
        byoConfigured: Boolean(text(f.openai_api_key).trim()),
        maskedKey: text(f.openai_api_key).trim()
          ? maskKey(text(f.openai_api_key))
          : null,
        platformKeyPresent: Boolean(process.env.OPENAI_API_KEY?.trim()),
      },
      members: members.map((m) => ({
        id: text(m.id),
        email: text(m.email),
        name: text(m.name) || "Unknown",
        role: text(m.role) || "staff",
      })),
      usage: {
        intakes: Number(countRows[0]?.intakes ?? 0),
        docs: Number(countRows[0]?.docs ?? 0),
        members: members.length,
      },
    };
  },
);

export const setFormActive = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) => input as { formId: string; isActive: boolean },
  )
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) throw new Error("Please sign in first.");
    await execute(
      `UPDATE intake_forms SET is_active = ${data.isActive ? 1 : 0}, updated_at = datetime('now')
       WHERE id = '${esc(data.formId)}' AND firm_id = '${esc(firm.id)}'`,
    );
    return { ok: true };
  });

// ─── Billing (Stripe, key-optional) ───────────────────────────

export interface BillingConfigState {
  configured: boolean;
  /** For the signed-in firm (null when signed out). */
  plan: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}

export const getBillingConfig = createServerFn({
  method: "GET",
}).handler(async (): Promise<BillingConfigState> => {
  await ensureSchema();
  const configured = billingConfigured().configured;
  const userId = await currentUserId();
  const firm = userId ? await firmForUser(userId) : null;
  return {
    configured,
    plan: firm?.plan ?? null,
    subscriptionStatus: firm?.subscription_status ?? null,
    currentPeriodEnd: firm?.current_period_end ?? null,
    hasCustomer: Boolean(firm?.stripe_customer_id),
  };
});

function requestOrigin(): string {
  try {
    const req = getRequest();
    // Behind the platform proxy the raw request URL can carry an internal
    // scheme/host, while the forwarded headers carry the public origin the
    // browser actually sees. Prefer the forwarded values when present so
    // absolute URLs we hand out (Stripe success/cancel/return URLs, intake
    // share links) always point at the public site.
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = fwdHost || req.headers.get("host");
    if (proto && host) return `${proto}://${host}`;
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

export const startCheckout = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) => input as { plan: "starter" | "pro"; userEmail?: string },
  )
  .handler(async ({ data }) => {
    const user = await getSessionUserRow();
    const firm = user?.firm_id ? await firmForUser(user.id) : null;
    if (!firm)
      throw new Error(
        "Your firm isn't set up yet — finish onboarding first, then subscribe.",
      );
    // Price IDs must be configured even when the secret key is present.
    if (!priceIdFor(data.plan)) {
      return {
        ok: false as const,
        message:
          "Billing isn't fully configured yet — the plan price ID hasn't been set by the owner.",
      };
    }
    const result = await createCheckoutSession({
      firmId: firm.id,
      firmName: firm.name,
      // Prefill from the signed-in account — never trust a client-supplied email.
      customerEmail: user?.email ?? "",
      plan: data.plan as PurchasablePlan,
      origin: requestOrigin(),
      existingCustomerId: firm.stripe_customer_id ?? null,
    });
    if (!result.ok) return { ok: false as const, message: result.message };
    return { ok: true as const, url: result.url };
  });

export const startPortal = createServerFn({ method: "POST" }).handler(
  async () => {
    const userId = await currentUserId();
    const firm = userId ? await firmForUser(userId) : null;
    if (!firm) throw new Error("Please sign in first.");
    const result = await createPortalSession({
      customerId: firm.stripe_customer_id ?? null,
      origin: requestOrigin(),
    });
    if (!result.ok) return { ok: false as const, message: result.message };
    return { ok: true as const, url: result.url };
  },
);
