import { NextResponse } from "next/server";

/**
 * Auth API route placeholder.
 *
 * Will be replaced by Clerk webhooks for:
 *   - POST /api/auth/webhook — Clerk user creation/update events
 *   - POST /api/auth/sign-out — Session management
 *
 * For now, returns a 501 Not Implemented.
 */

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Auth API not yet implemented — integrate Clerk" },
    { status: 501 },
  );
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Auth API not yet implemented — integrate Clerk" },
    { status: 501 },
  );
}