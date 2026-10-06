import { Link, createFileRoute } from "@tanstack/react-router";

import { CopyButton, StatusBadge } from "~/components/ui";
import { fmtDate } from "~/lib/fmt";
import { getIntakeFormDetail } from "~/lib/server";

export const Route = createFileRoute("/dashboard/intake/$formId/")({
  loader: async ({ params }) => {
    try {
      return await getIntakeFormDetail({ data: { formId: params.formId } });
    } catch {
      return {
        mode: "not-found" as const,
        form: { id: "", title: "", description: "", fields: [], isActive: false },
        submissions: [],
        shareUrl: "",
      };
    }
  },
  component: FormDetailPage,
});

function FormDetailPage() {
  const data = Route.useLoaderData();
  const { formId } = Route.useParams();

  if (data.mode === "not-found") {
    return (
      <div className="p-6">
        <p className="text-red-600">Form not found.</p>
        <Link
          to="/dashboard/intake"
          className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700"
        >
          ← Back to intake forms
        </Link>
      </div>
    );
  }
  if (data.mode === "no-firm") {
    return (
      <div className="p-6 text-muted-foreground">
        Your account isn't linked to a firm yet.
        <Link
          to="/onboarding"
          className="ml-2 font-medium text-primary-600 hover:text-primary-700"
        >
          Complete onboarding →
        </Link>
      </div>
    );
  }

  const { form, submissions, shareUrl } = data;

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.description ? (
            <p className="mt-1 text-muted-foreground">{form.description}</p>
          ) : null}
        </div>
        <StatusBadge status={form.isActive ? "active" : "inactive"} />
      </div>

      {shareUrl && (
        <div className="mt-6 rounded-xl border p-4">
          <label htmlFor="share-url" className="block text-sm font-medium">
            Shareable Client Link
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="share-url"
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 font-mono text-sm"
            />
            <CopyButton text={shareUrl} />
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border p-6">
        <h2 className="text-lg font-semibold">Form Fields ({form.fields.length})</h2>
        <div className="mt-3 space-y-2">
          {form.fields.map((field, i) => (
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

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Submissions ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <div className="mt-3 rounded-xl border p-8 text-center text-sm text-muted-foreground">
            No submissions yet. Share the form link with your clients.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {submissions.map((sub) => (
              <Link
                key={sub.id}
                to="/dashboard/intake/$formId/submissions/$submissionId"
                params={{ formId, submissionId: sub.id }}
                className="block rounded-xl border p-4 transition-all hover:border-primary-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {sub.summary.split("|")[0].trim()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmtDate(sub.createdAt, true)}
                    </p>
                  </div>
                  <span className="ml-2">
                    <StatusBadge status={sub.status} />
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
