import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { execute, query } from "@/lib/db-client";

// GET /api/intake/forms/[formId] — Get a single intake form
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { formId } = await params;

  const forms = await query<Record<string, unknown>>(
    `SELECT * FROM intake_forms WHERE id = '${formId.replace(/'/g, "''")}'`
  );
  if (!forms.length) {
    return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
  }

  const form = forms[0];
  return NextResponse.json({
    success: true,
    data: {
      ...form,
      fields: typeof form.fields === "string" ? JSON.parse(form.fields as string) : form.fields,
    },
  });
}

// PATCH /api/intake/forms/[formId] — Update form (title, description, fields, active status)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { formId } = await params;
  const body = await req.json();
  const updates: string[] = [];

  if (body.title !== undefined) {
    updates.push(`title = '${String(body.title).replace(/'/g, "''")}'`);
  }
  if (body.description !== undefined) {
    updates.push(`description = '${String(body.description).replace(/'/g, "''")}'`);
  }
  if (body.fields !== undefined) {
    updates.push(`fields = '${JSON.stringify(body.fields).replace(/'/g, "''")}'`);
  }
  if (body.isActive !== undefined) {
    updates.push(`is_active = ${body.isActive ? 1 : 0}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  await execute(
    `UPDATE intake_forms SET ${updates.join(", ")} WHERE id = '${formId.replace(/'/g, "''")}'`
  );

  return NextResponse.json({ success: true });
}

// DELETE /api/intake/forms/[formId] — Delete a form
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const session = await auth();
  const userId = session.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { formId } = await params;

  // Delete submissions first, then the form
  await execute(`DELETE FROM intake_submissions WHERE form_id = '${formId.replace(/'/g, "''")}'`);
  await execute(`DELETE FROM intake_forms WHERE id = '${formId.replace(/'/g, "''")}'`);

  return NextResponse.json({ success: true });
}