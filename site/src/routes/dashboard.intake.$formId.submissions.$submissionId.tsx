import { useState } from "react";
import {
  Link,
  createFileRoute,
  useRouter,
} from "@tanstack/react-router";

import { StatusBadge } from "~/components/ui";
import { fmtDate } from "~/lib/fmt";
import { getSubmission, setSubmissionStatus } from "~/lib/server";

export const Route = createFileRoute(
  "/dashboard/intake/$formId/submissions/$submissionId",
)({
  loader: async ({ params }) => {
    try {
      return await getSubmission({ data: { submissionId: params.submissionId } });
    } catch {
      return {
        mode: "not-found" as const,
        submission: {
          id: "",
          formId: "",
          formTitle: "",
          data: {},
          caseSummary: "",
          status: "",
          createdAt: "",
        },
        fieldLabels: {},
      };
    }
  },
  component: SubmissionDetailPage,
});

function SubmissionDetailPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  if (data.mode === "not-found") {
    return (
      <div className="p-6">
        <p className="text-red-600">Submission not found.</p>
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

  const { submission, fieldLabels } = data;
  const entries = Object.entries(submission.data);

  const handleStatus = async (status: string) => {
    setUpdating(true);
    setError("");
    try {
      await setSubmissionStatus({
        data: { submissionId: submission.id, status },
      });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/dashboard/intake/$formId"
        params={{ formId: submission.formId }}
        className="text-sm text-primary-600 hover:text-primary-700"
      >
        ← Back to {submission.formTitle || "form"}
      </Link>

      <div className="mt-3 flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">
            {submission.caseSummary.split("|")[0].trim() || "Submission"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Received {fmtDate(submission.createdAt, true)}
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      {submission.caseSummary && (
        <div className="mt-6 rounded-xl border bg-muted/20 p-4">
          <h2 className="text-sm font-semibold">Auto-Generated Case Summary</h2>
          <p className="mt-2 text-sm">{submission.caseSummary}</p>
        </div>
      )}

      <div className="mt-6 rounded-xl border">
        <div className="border-b px-5 py-3">
          <h2 className="font-semibold">Submitted Data</h2>
        </div>
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No data recorded for this submission.
          </p>
        ) : (
          <div className="divide-y">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-4 px-5 py-3">
                <span className="w-40 shrink-0 text-sm text-muted-foreground">
                  {fieldLabels[key] ?? key}
                </span>
                <span className="min-w-0 flex-1 text-sm whitespace-pre-wrap">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {submission.status === "pending" && (
          <button
            type="button"
            onClick={() => handleStatus("reviewed")}
            disabled={updating}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Mark as Reviewed
          </button>
        )}
        {submission.status !== "archived" ? (
          <button
            type="button"
            onClick={() => handleStatus("archived")}
            disabled={updating}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Archive
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleStatus("pending")}
            disabled={updating}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Restore to Pending
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
