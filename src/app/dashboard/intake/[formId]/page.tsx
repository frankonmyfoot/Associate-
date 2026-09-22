import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/db-client";
import type { IntakeField, IntakeSubmission } from "@/types";

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const session = await auth();
  if (!session.userId) {
    return <div className="p-6 text-red-600">Not authenticated</div>;
  }

  const { formId } = await params;

  // Fetch form
  const forms = await query<Record<string, unknown>>(
    `SELECT * FROM intake_forms WHERE id = '${formId.replace(/'/g, "''")}'`
  );
  if (!forms.length) {
    return <div className="p-6">Form not found</div>;
  }

  const form = forms[0] as Record<string, unknown>;
  const fields: IntakeField[] =
    typeof form.fields === "string" ? JSON.parse(form.fields as string) : (form.fields as IntakeField[]);

  // Fetch submissions
  const submissions = await query<Record<string, unknown>>(
    `SELECT id, status, created_at, case_summary
     FROM intake_submissions WHERE form_id = '${formId.replace(/'/g, "''")}'
     ORDER BY created_at DESC`
  );

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/intake/${formId}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{form.title as string}</h1>
          {form.description ? (
            <p className="mt-1 text-muted-foreground">{String(form.description)}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              form.is_active
                ? "bg-green-100 text-green-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {form.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Share Link */}
      <div className="mt-6 rounded-xl border p-4">
        <label className="block text-sm font-medium">Shareable Client Link</label>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-mono"
          />
          <CopyButton text={shareUrl} />
        </div>
      </div>

      {/* Fields Preview */}
      <div className="mt-6 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Form Fields ({fields.length})</h2>
        <div className="mt-3 space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-muted-foreground">{i + 1}.</span>
              <span className="font-medium">{field.label || "Untitled"}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {field.type}
              </span>
              {field.required && (
                <span className="text-xs text-red-500">Required</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Submissions */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">
          Submissions ({submissions.length})
        </h2>

        {submissions.length === 0 ? (
          <div className="mt-3 rounded-xl border p-8 text-center text-sm text-muted-foreground">
            No submissions yet. Share the form link with your clients.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {submissions.map((sub) => (
              <Link
                key={sub.id as string}
                href={`/dashboard/intake/${formId}/submissions/${sub.id}`}
                className="block rounded-xl border p-4 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {sub.case_summary
                        ? (sub.case_summary as string).split("|")[0].trim()
                        : "Submission"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(sub.created_at as string).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      String(sub.status) === "reviewed"
                        ? "bg-green-100 text-green-700"
                        : String(sub.status) === "archived"
                          ? "bg-muted text-muted-foreground"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {String(sub.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <form
      action={async () => {
        "use server";
        // Copy happens client-side
      }}
    >
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
        }}
        className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        Copy
      </button>
    </form>
  );
}