import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { execute, query, generateId } from "@/lib/db-client";

// GET /api/intake/forms — List all intake forms for the current firm
export async function GET() {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // Get the user's firm
  const users = await query<{ firm_id: string }>(
    `SELECT firm_id FROM firm_users WHERE clerk_user_id = '${userId.replace(/'/g, "''")}'`
  );
  if (!users.length) {
    return NextResponse.json({ success: false, error: "No firm found" }, { status: 404 });
  }
  const firmId = users[0].firm_id;

  const forms = await query<Record<string, unknown>>(
    `SELECT id, firm_id, title, description, fields, is_active, created_at, updated_at
     FROM intake_forms WHERE firm_id = '${firmId.replace(/'/g, "''")}'
     ORDER BY created_at DESC`
  );

  // Parse fields JSON for each form
  const parsed = forms.map((f) => ({
    ...f,
    fields: typeof f.fields === "string" ? JSON.parse(f.fields as string) : f.fields,
  }));

  return NextResponse.json({ success: true, data: parsed });
}

// POST /api/intake/forms — Create a new intake form
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
  const { title, description, fields } = body;

  if (!title || !title.trim()) {
    return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
  }

  const id = generateId();
  const fieldsJson = JSON.stringify(fields || []);

  await execute(
    `INSERT INTO intake_forms (id, firm_id, title, description, fields, is_active, created_at, updated_at)
     VALUES ('${id.replace(/'/g, "''")}', '${firmId.replace(/'/g, "''")}',
             '${title.replace(/'/g, "''")}',
             ${description ? `'${description.replace(/'/g, "''")}'` : "NULL"},
             '${fieldsJson.replace(/'/g, "''")}', 1,
             datetime('now'), datetime('now'))`
  );

  return NextResponse.json({
    success: true,
    data: { id, firmId, title, description, fields, isActive: 1 },
  });
}