import { query } from "@/lib/db-client";
import type { IntakeField } from "@/types";
import IntakeFormClient from "./IntakeFormClient";

export default async function PublicIntakeFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;

  const forms = await query<Record<string, unknown>>(
    `SELECT id, title, description, fields FROM intake_forms WHERE id = '${formId.replace(/'/g, "''")}' AND is_active = 1`
  );

  if (!forms.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <span className="text-2xl font-bold text-muted-foreground">!</span>
          </div>
          <h1 className="text-xl font-bold">Form Not Available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This intake form is no longer active or doesn&apos;t exist. Please
            contact the law firm directly.
          </p>
        </div>
      </div>
    );
  }

  const form = forms[0] as Record<string, unknown>;
  const formTitle = String(form.title ?? "");
  const formDescription = form.description ? String(form.description) : null;
  const fields: IntakeField[] =
    typeof form.fields === "string"
      ? JSON.parse(form.fields as string)
      : (form.fields as IntakeField[]);

  return (
    <div className="min-h-screen bg-muted/30 py-12">
      <div className="mx-auto max-w-2xl px-4">
        {/* Firm header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-primary-600 flex items-center justify-center">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold">{formTitle}</h1>
          {formDescription ? (
            <p className="mt-2 text-muted-foreground">{formDescription}</p>
          ) : null}
        </div>

        <IntakeFormClient formId={formId} fields={fields} />
      </div>
    </div>
  );
}