/**
 * Server layer for the AssociateAI product (ported from the Next.js MVP).
 *
 * All server logic lives in `createServerFn()` handlers — TanStack Start's
 * supported server-logic pattern in this version (file-based API routes no
 * longer exist here; only the health endpoint is a raw path, intercepted in
 * serve.ts). Auth is Clerk: the session token from the `__session` cookie (or
 * Authorization header) is verified with @clerk/backend `verifyToken` — see
 * `currentUserId()`. Everything is key-optional: with no Clerk secret key the
 * server treats requests as signed out instead of failing.
 *
 * DB: team-db CLI via src/lib/db.ts. One SQL statement per team-db call —
 * aggregate reads are consolidated into single statements with scalar
 * subqueries so pages need 2-3 CLI round trips, not one per count.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifyToken } from "@clerk/backend";

import {
  ensureSchema,
  esc,
  execute,
  generateId,
  intLit,
  lit,
  query,
} from "~/lib/db";
import { generateDocument } from "~/lib/ai";
import { getDocumentType } from "~/lib/documents";
import type { DocumentType, IntakeField, IntakeFieldType } from "~/lib/types";

// ─── Clerk configuration ──────────────────────────────────────

interface ClerkKeys {
  publishableKey: string | null;
  secretKey: string | null;
}

function clerkServerKeys(): ClerkKeys {
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    null;
  const secretKey = process.env.CLERK_SECRET_KEY || null;
  return { publishableKey, secretKey };
}

function cookieToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "__session") return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

async function currentUserId(): Promise<string | null> {
  const { secretKey } = clerkServerKeys();
  if (!secretKey) return null;
  try {
    const req = getRequest();
    const token =
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      cookieToken(req);
    if (!token) return null;
    const claims = await verifyToken(token, { secretKey });
    return claims?.sub ?? null;
  } catch {
    return null;
  }
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

// ─── Public config (for key-optional Clerk) ───────────────────

export const getPublicConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const { publishableKey } = clerkServerKeys();
    return { clerkPublishableKey: publishableKey };
  },
);

// ─── Auth / onboarding ────────────────────────────────────────

async function firmForUser(userId: string) {
  const rows = await query<{
    id: string;
    name: string;
    plan: string;
    slug: string;
  }>(
    `SELECT f.id, f.name, f.plan, f.slug FROM firms f
     JOIN firm_users fu ON fu.firm_id = f.id
     WHERE fu.clerk_user_id = '${esc(userId)}' LIMIT 1`,
  );
  return rows[0] ?? null;
}

export interface DashboardAuthState {
  mode: "no-keys" | "signed-out" | "no-firm" | "ok";
  firmName?: string;
  userName?: string;
  clerkKey?: boolean;
}

export const getDashboardAuthState = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardAuthState> => {
  await ensureSchema();
  const { publishableKey } = clerkServerKeys();
  if (!publishableKey) {
    return { mode: "no-keys", clerkKey: false };
  }
  const userId = await currentUserId();
  if (!userId) {
    return { mode: "signed-out", clerkKey: true };
  }
  const firm = await firmForUser(userId);
  if (!firm) {
    return { mode: "no-firm", clerkKey: true };
  }
  const users = await query<{ name: string }>(
    `SELECT name FROM firm_users WHERE clerk_user_id = '${esc(userId)}' LIMIT 1`,
  );
  return {
    mode: "ok",
    clerkKey: true,
    firmName: firm.name,
    userName: users[0]?.name ?? "",
  };
});

export const onboardFirm = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as {
        firmName: string;
        practiceAreas?: string;
        teamSize?: string;
        userName?: string;
        userEmail?: string;
      },
  )
  .handler(async ({ data }) => {
    await ensureSchema();
    const userId = await currentUserId();
    if (!userId) {
      throw new Error(
        "Sign-in is not available on this deployment yet — Clerk keys are not connected, so firms cannot be created.",
      );
    }
    const firmName = (data.firmName ?? "").trim().slice(0, 200);
    if (!firmName) throw new Error("Firm name is required");

    const existing = await firmForUser(userId);
    if (existing) return { firmId: existing.id };

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
      `INSERT INTO firm_users (id, firm_id, clerk_user_id, email, name, role, created_at, updated_at)
       VALUES ('${generateId()}', '${firmId}', '${esc(userId)}', ${lit((data.userEmail ?? "").trim().slice(0, 320) || null)}, ${lit((data.userName ?? "").trim().slice(0, 200) || "Firm Admin")}, 'admin', datetime('now'), datetime('now'))`,
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
    let origin = "";
    try {
      origin = new URL(getRequest().url).origin;
    } catch {
      origin = "";
    }
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
    await execute(
      `INSERT INTO intake_submissions (id, form_id, firm_id, data, case_summary, status, created_at)
       VALUES ('${id}', '${esc(data.formId)}', '${esc(firmId)}', '${esc(JSON.stringify(submittedData))}', '${esc(caseSummary)}', 'pending', datetime('now'))`,
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
    if (!getDocumentType(data.documentType))
      throw new Error("Unknown document type");
    const caseDetails: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.caseDetails ?? {}).slice(0, 60)) {
      caseDetails[k.slice(0, 60)] = String(v).slice(0, 20_000);
    }
    if (Object.keys(caseDetails).length === 0)
      throw new Error("Case details are required");
    return generateDocument({
      documentType: data.documentType as DocumentType,
      caseDetails,
    });
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
      `SELECT id, email, name, role, created_at FROM firm_users
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
