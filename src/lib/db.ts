/**
 * Database client for AssociateAI.
 *
 * Uses team-db CLI for prototyping (Turso-synced SQLite).
 * Designed for easy migration to PostgreSQL in production.
 */

import { execute as rawExecute, query as rawQuery } from "./db-client";

// ─── Schema Initialization ────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  practice_areas TEXT,
  team_size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS firm_users (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'attorney' CHECK(role IN ('admin','attorney','paralegal','staff')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intake_forms (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  title TEXT NOT NULL,
  description TEXT,
  fields TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intake_submissions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES intake_forms(id),
  firm_id TEXT NOT NULL REFERENCES firms(id),
  data TEXT NOT NULL DEFAULT '{}',
  case_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS document_drafts (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  case_details TEXT,
  source_submission_id TEXT REFERENCES intake_submissions(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','finalized','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * Initialize the database schema.
 * Call this once on app startup or first deploy.
 */
export async function initSchema(): Promise<void> {
  const statements = SCHEMA_SQL.split(";").filter((s) => s.trim().length > 0);
  for (const stmt of statements) {
    await rawExecute(stmt + ";");
  }
}

// ─── Firm Queries ─────────────────────────────────────────────

export async function createFirm(
  id: string,
  name: string,
  slug: string,
  practiceAreas?: string,
  teamSize?: number,
): Promise<void> {
  await rawExecute(
    `INSERT INTO firms (id, name, slug, practice_areas, team_size, created_at, updated_at)
     VALUES ('${id}', '${escape(name)}', '${escape(slug)}', ${practiceAreas ? `'${escape(practiceAreas)}'` : "NULL"}, ${teamSize ?? "NULL"}, datetime('now'), datetime('now'))`,
  );
}

export async function getFirm(id: string) {
  const results = await rawQuery<Record<string, unknown>>(
    `SELECT * FROM firms WHERE id = '${id}'`,
  );
  return results[0] ?? null;
}

export async function getFirmBySlug(slug: string) {
  const results = await rawQuery<Record<string, unknown>>(
    `SELECT * FROM firms WHERE slug = '${escape(slug)}'`,
  );
  return results[0] ?? null;
}

// ─── Firm User Queries ────────────────────────────────────────

export async function addFirmUser(
  id: string,
  firmId: string,
  clerkUserId: string,
  email: string,
  name: string,
  role: string = "attorney",
): Promise<void> {
  await rawExecute(
    `INSERT INTO firm_users (id, firm_id, clerk_user_id, email, name, role, created_at, updated_at)
     VALUES ('${id}', '${firmId}', '${escape(clerkUserId)}', '${escape(email)}', '${escape(name)}', '${role}', datetime('now'), datetime('now'))`,
  );
}

export async function getFirmUserByClerkId(clerkUserId: string) {
  const results = await rawQuery<Record<string, unknown>>(
    `SELECT * FROM firm_users WHERE clerk_user_id = '${escape(clerkUserId)}'`,
  );
  return results[0] ?? null;
}

export async function getFirmUsers(firmId: string) {
  return rawQuery<Record<string, unknown>>(
    `SELECT * FROM firm_users WHERE firm_id = '${firmId}' ORDER BY created_at ASC`,
  );
}

// ─── Intake Queries ───────────────────────────────────────────

export async function createIntakeForm(
  id: string,
  firmId: string,
  title: string,
  fieldsJson: string = "[]",
) {
  await rawExecute(
    `INSERT INTO intake_forms (id, firm_id, title, fields, created_at, updated_at)
     VALUES ('${id}', '${firmId}', '${escape(title)}', '${escape(fieldsJson)}', datetime('now'), datetime('now'))`,
  );
}

export async function getIntakeForms(firmId: string) {
  return rawQuery<Record<string, unknown>>(
    `SELECT * FROM intake_forms WHERE firm_id = '${firmId}' ORDER BY created_at DESC`,
  );
}

// ─── Document Queries ─────────────────────────────────────────

export async function createDocumentDraft(
  id: string,
  firmId: string,
  title: string,
  documentType: string,
  content: string = "",
) {
  await rawExecute(
    `INSERT INTO document_drafts (id, firm_id, title, document_type, content, status, created_at, updated_at)
     VALUES ('${id}', '${firmId}', '${escape(title)}', '${escape(documentType)}', '${escape(content)}', 'draft', datetime('now'), datetime('now'))`,
  );
}

export async function getDocumentDrafts(firmId: string) {
  return rawQuery<Record<string, unknown>>(
    `SELECT * FROM document_drafts WHERE firm_id = '${firmId}' ORDER BY created_at DESC`,
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function escape(value: string): string {
  return value.replace(/'/g, "''");
}

export { rawExecute as execute, rawQuery as query };