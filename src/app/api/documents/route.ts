import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { execute, query, generateId } from "@/lib/db-client";

// GET /api/documents — List all document drafts for the firm
export async function GET() {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const users = await query<{ firm_id: string }>(
    `SELECT firm_id FROM firm_users WHERE clerk_user_id = '${userId.replace(/'/g, "''")}'`
  );
  if (!users.length) {
    return NextResponse.json({ success: false, error: "No firm found" }, { status: 404 });
  }
  const firmId = users[0].firm_id;

  const docs = await query<Record<string, unknown>>(
    `SELECT id, firm_id, title, document_type, status, created_at, updated_at
     FROM document_drafts WHERE firm_id = '${firmId.replace(/'/g, "''")}'
     ORDER BY updated_at DESC`
  );

  return NextResponse.json({ success: true, data: docs });
}

// POST /api/documents — Create a new document draft
export async function POST(req: Request) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const users = await query<{ firm_id: string }>(
    `SELECT firm_id FROM firm_users WHERE clerk_user_id = '${userId.replace(/'/g, "''")}'`
  );
  if (!users.length) {
    return NextResponse.json({ success: false, error: "No firm found" }, { status: 404 });
  }
  const firmId = users[0].firm_id;

  const body = await req.json();
  const { title, documentType, content, caseDetails, sourceSubmissionId } = body;

  if (!title || !documentType) {
    return NextResponse.json({ success: false, error: "Title and document type required" }, { status: 400 });
  }

  const id = generateId();

  await execute(
    `INSERT INTO document_drafts (id, firm_id, title, document_type, content, case_details, source_submission_id, status, created_at, updated_at)
     VALUES ('${id.replace(/'/g, "''")}', '${firmId.replace(/'/g, "''")}',
             '${String(title).replace(/'/g, "''")}',
             '${String(documentType).replace(/'/g, "''")}',
             '${(content || "").replace(/'/g, "''")}',
             '${JSON.stringify(caseDetails || {}).replace(/'/g, "''")}',
             ${sourceSubmissionId ? `'${String(sourceSubmissionId).replace(/'/g, "''")}'` : "NULL"},
             'draft', datetime('now'), datetime('now'))`
  );

  return NextResponse.json({ success: true, data: { id } });
}