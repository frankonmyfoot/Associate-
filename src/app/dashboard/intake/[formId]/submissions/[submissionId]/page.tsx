import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/db-client";
import type { IntakeField } from "@/types";
import SubmissionActions from "./SubmissionActions";

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ formId: string; submissionId: string }>;
}) {
  const session = await auth();
  if (!session.userId) {
    return <div className="p-6 text-red-600">Not authenticated</div>;
  }

  const { formId, submissionId } = await params;

  // Fetch the submission
  const submissions = await query<Record<string, unknown>>(
    `SELECT * FROM intake_submissions WHERE id = '${submissionId.replace(/'/g, "''")}' AND form_id = '${formId.replace(/'/g, "''")}'`
  );
  if (!submissions.length) {
    return <div className="p-6">Submission not found</div>;
  }

  const sub = submissions[0];
  const formData: Record<string, string> =
    typeof sub.data === "string" ? JSON.parse(sub.data as string) : (sub.data as Record<string, string>);

  // Fetch the form to get field labels
  const forms = await query<Record<string, unknown>>(
    `SELECT title, fields FROM intake_forms WHERE id = '${formId.replace(/'/g, "''")}'`
  );
  const form = forms[0];
  const fields: IntakeField[] = form?.fields
    ? typeof form.fields === "string"
      ? JSON.parse(form.fields as string)
      : (form.fields as IntakeField[])
    : [];

  // Build a label map
  const labelMap: Record<string, string> = {};
  for (const field of fields) {
    labelMap[field.id] = field.label;
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    reviewed: "bg-green-100 text-green-700",
    archived: "bg-muted text-muted-foreground",
  };

  const subStatus = String(sub.status ?? "pending");
  const subCreatedAt = String(sub.created_at ?? "");
  const subCaseSummary = sub.case_summary ? String(sub.case_summary) : null;
  const formTitle = form?.title ? String(form.title) : null;

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <a
        href={`/dashboard/intake/${formId}`}
        className="text-sm text-primary-600 hover:text-primary-700"
      >
        &larr; Back to form
      </a>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Submission Detail</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formTitle ? `From: ${formTitle}` : ""} &middot;{" "}
            {subCreatedAt
              ? new Date(subCreatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            statusColors[subStatus] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {subStatus}
        </span>
      </div>

      {/* Case Summary */}
      {subCaseSummary ? (
        <div className="mt-6 rounded-xl border bg-primary-50/50 p-4">
          <h2 className="text-sm font-semibold text-primary-800">Case Summary</h2>
          <p className="mt-1 text-sm text-primary-700">{subCaseSummary}</p>
        </div>
      ) : null}

      {/* Submitted Data */}
      <div className="mt-6 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Submitted Information</h2>
        <div className="mt-4 divide-y">
          {Object.entries(formData).map(([fieldId, value]) => (
            <div key={fieldId} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium text-muted-foreground">
                {labelMap[fieldId] || fieldId}
              </p>
              <p className="mt-0.5 text-sm">{value || "(empty)"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <SubmissionActions
        submissionId={submissionId}
        currentStatus={subStatus}
      />
    </div>
  );
}