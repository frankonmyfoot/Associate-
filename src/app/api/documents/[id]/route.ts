import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { execute, query } from "@/lib/db-client";

// GET /api/documents/[id] — Get a single document
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const docs = await query<Record<string, unknown>>(
    `SELECT * FROM document_drafts WHERE id = '${id.replace(/'/g, "''")}'`,
  );
  if (!docs.length) {
    return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
  }

  const doc = docs[0];
  return NextResponse.json({
    success: true,
    data: {
      ...doc,
      case_details: doc.case_details
        ? typeof doc.case_details === "string"
          ? JSON.parse(doc.case_details as string)
          : doc.case_details
        : null,
    },
  });
}

// PATCH /api/documents/[id] — Update a document (title, content, status)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const updates: string[] = [];

  if (body.title !== undefined) {
    updates.push(`title = '${String(body.title).replace(/'/g, "''")}'`);
  }
  if (body.content !== undefined) {
    updates.push(`content = '${String(body.content).replace(/'/g, "''")}'`);
  }
  if (body.status !== undefined) {
    const validStatuses = ["draft", "finalized", "archived"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }
    updates.push(`status = '${body.status}'`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  await execute(
    `UPDATE document_drafts SET ${updates.join(", ")} WHERE id = '${id.replace(/'/g, "''")}'`,
  );

  return NextResponse.json({ success: true });
}

// DELETE /api/documents/[id] — Delete a document
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  await execute(`DELETE FROM document_drafts WHERE id = '${id.replace(/'/g, "''")}'`);

  return NextResponse.json({ success: true });
}