/**
 * Low-level database client.
 *
 * Wraps the `team-db` CLI for Turso-synced SQLite.
 * Every call: pull → execute → push.
 */

import { execSync } from "child_process";

export interface DbResult {
  [key: string]: unknown;
}

/**
 * Execute a SQL query via the team-db CLI.
 * Returns parsed JSON results.
 */
export function query<T extends DbResult = DbResult>(sql: string): T[] {
  const escaped = sql.replace(/"/g, '\\"');
  const result = execSync(`team-db "${escaped}"`, {
    encoding: "utf-8",
    timeout: 10_000,
  });
  return JSON.parse(result) as T[];
}

/**
 * Execute a write query (INSERT, UPDATE, DELETE, CREATE TABLE).
 */
export function execute(sql: string): void {
  query(sql);
}

/**
 * Get the current timestamp in ISO format.
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Generate a unique ID.
 */
export function generateId(): string {
  return crypto.randomUUID();
}