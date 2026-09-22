/**
 * Authentication module for AssociateAI.
 *
 * Uses Clerk for auth, session management, and multi-tenant organization support.
 *
 * Server Components / API Routes:
 *   import { auth, currentUser } from "@clerk/nextjs/server"
 *
 * Client Components:
 *   import { useAuth, useUser } from "@clerk/nextjs"
 */

// ─── Re-export Clerk utilities for convenience ────────────────

export {
  auth,
  currentUser,
  clerkClient,
} from "@clerk/nextjs/server";

// ─── Types ─────────────────────────────────────────────────────

export interface FirmUser {
  id: string;
  email: string;
  name: string;
  firmId: string;
  role: "admin" | "attorney" | "paralegal" | "staff";
}

/**
 * Clerk's auth() returns session claims. We augment with our custom role.
 */
export type AuthRole = "admin" | "attorney" | "paralegal" | "staff";

/**
 * Resolve a user's role within their firm.
 * In production, this would check a `firm_users` database table.
 * For now, the first user in a firm gets "admin" role.
 */
export async function getUserRole(
  userId: string,
  firmId: string,
): Promise<AuthRole | null> {
  // TODO: Query the firm_users table for the user's role
  // For now, default to "admin" for prototyping
  return "admin";
}

/**
 * Require a specific role to access a resource.
 * Throws if the user doesn't have the required role.
 */
export async function requireRole(
  userId: string,
  firmId: string,
  requiredRole: AuthRole,
): Promise<void> {
  const role = await getUserRole(userId, firmId);
  if (!role) {
    throw new Error("User not found in firm");
  }

  const hierarchy: AuthRole[] = ["admin", "attorney", "paralegal", "staff"];
  const userLevel = hierarchy.indexOf(role);
  const requiredLevel = hierarchy.indexOf(requiredRole);

  if (userLevel > requiredLevel) {
    throw new Error(
      `Insufficient role. Required: ${requiredRole}, Actual: ${role}`,
    );
  }
}

/**
 * Check if a user is an admin of their firm.
 */
export async function isAdmin(
  userId: string,
  firmId: string,
): Promise<boolean> {
  const role = await getUserRole(userId, firmId);
  return role === "admin";
}