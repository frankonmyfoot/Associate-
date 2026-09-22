import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { execute, query } from "@/lib/db-client";

// GET /api/intake/submissions/[id] — Get a single submission
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const submissions = await query<Record<string, unknown>>(
    `SELECT * FROM intake_submissions WHERE id = '${id.replace(/'/g, "''")}'`
  );
  if (!submissions.length) {
    return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });
  }

  const sub = submissions[0];
  return NextResponse.json({
    success: true,
    data: {
      ...sub,
      data: typeof sub.data === "string" ? JSON.parse(sub.data as string) : sub.data,
    },
  });
}

// PATCH /api/intake/submissions/[id] — Update submission status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.status) {
    const validStatuses = ["pending", "reviewed", "archived"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const reviewedPart = body.status === "reviewed" ? ", reviewed_at = datetime('now')" : "";
    await execute(
      `UPDATE intake_submissions SET status = '${body.status}'${reviewedPart} WHERE id = '${id.replace(/'/g, "''")}'`
    );
  }

  return NextResponse.json({ success: true });
}