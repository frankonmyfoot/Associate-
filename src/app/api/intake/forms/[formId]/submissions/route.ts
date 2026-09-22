import { NextResponse } from "next/server";
import { execute, query, generateId } from "@/lib/db-client";

// GET /api/intake/forms/[formId]/submissions — List submissions for a form
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;

  const submissions = await query<Record<string, unknown>>(
    `SELECT id, form_id, firm_id, data, case_summary, status, created_at, reviewed_at
     FROM intake_submissions WHERE form_id = '${formId.replace(/'/g, "''")}'
     ORDER BY created_at DESC`
  );

  const parsed = submissions.map((s) => ({
    ...s,
    data: typeof s.data === "string" ? JSON.parse(s.data as string) : s.data,
  }));

  return NextResponse.json({ success: true, data: parsed });
}

// POST /api/intake/forms/[formId]/submissions — Submit intake data (public)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;

  // Verify the form exists and is active
  const forms = await query<Record<string, unknown>>(
    `SELECT id, firm_id, fields FROM intake_forms WHERE id = '${formId.replace(/'/g, "''")}' AND is_active = 1`
  );
  if (!forms.length) {
    return NextResponse.json({ success: false, error: "Form not found or inactive" }, { status: 404 });
  }

  const form = forms[0];
  const formFields = typeof form.fields === "string" ? JSON.parse(form.fields as string) : form.fields;
  const firmId = form.firm_id as string;

  const body = await req.json();
  const submittedData = body.data || {};

  // Validate required fields
  for (const field of formFields) {
    if (field.required && !submittedData[field.id]) {
      return NextResponse.json(
        { success: false, error: `Field "${field.label}" is required` },
        { status: 400 }
      );
    }
  }

  const id = generateId();
  const dataJson = JSON.stringify(submittedData);

  // Generate a simple case summary
  const caseSummary = generateCaseSummary(submittedData, formFields);

  await execute(
    `INSERT INTO intake_submissions (id, form_id, firm_id, data, case_summary, status, created_at)
     VALUES ('${id.replace(/'/g, "''")}', '${formId.replace(/'/g, "''")}',
             '${firmId.replace(/'/g, "''")}', '${dataJson.replace(/'/g, "''")}',
             '${caseSummary.replace(/'/g, "''")}', 'pending', datetime('now'))`
  );

  return NextResponse.json({
    success: true,
    data: { id, caseSummary },
  });
}

function generateCaseSummary(data: Record<string, string>, fields: Array<{ id: string; label: string; type: string }>): string {
  // Find relevant fields for a summary
  const nameField = fields.find(
    (f) => f.type === "text" && /name|full.?name|client.?name/i.test(f.label)
  );
  const emailField = fields.find(
    (f) => f.type === "email" || (f.type === "text" && /email/i.test(f.label))
  );
  const phoneField = fields.find(
    (f) => f.type === "phone" || (f.type === "text" && /phone|telephone/i.test(f.label))
  );
  const descField = fields.find(
    (f) => f.type === "textarea" && /describe|details|explain|description/i.test(f.label)
  );

  const parts: string[] = [];
  if (nameField && data[nameField.id]) parts.push(`Client: ${data[nameField.id]}`);
  if (emailField && data[emailField.id]) parts.push(`Email: ${data[emailField.id]}`);
  if (phoneField && data[phoneField.id]) parts.push(`Phone: ${data[phoneField.id]}`);
  if (descField && data[descField.id]) {
    const desc = data[descField.id];
    parts.push(`Details: ${desc.length > 100 ? desc.substring(0, 100) + "..." : desc}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "Submitted via intake form";
}