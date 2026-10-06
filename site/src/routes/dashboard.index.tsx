import { Link, createFileRoute } from "@tanstack/react-router";

import { StatusBadge } from "~/components/ui";
import { fmtDate } from "~/lib/fmt";
import { getDashboardStats } from "~/lib/server";

export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    try {
      return await getDashboardStats();
    } catch {
      return {
        mode: "no-firm" as const,
        counts: {
          intakeForms: 0,
          pendingIntakes: 0,
          reviewedIntakes: 0,
          draftDocs: 0,
          finalizedDocs: 0,
        },
        recentSubmissions: [],
        recentDocs: [],
      };
    }
  },
  component: DashboardHome,
});

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function DashboardHome() {
  const data = Route.useLoaderData();

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-muted-foreground">
          Here's your firm's overview.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Intake Forms" value={data.counts.intakeForms} />
        <StatCard
          label="Pending Intakes"
          value={data.counts.pendingIntakes}
          tone="text-yellow-600"
        />
        <StatCard
          label="Draft Documents"
          value={data.counts.draftDocs}
          tone="text-blue-600"
        />
        <StatCard
          label="Finalized"
          value={data.counts.finalizedDocs}
          tone="text-green-600"
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            to="/dashboard/intake/new"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            + New Intake Form
          </Link>
          <Link
            to="/dashboard/documents/new"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            + Generate Document
          </Link>
          <Link
            to="/dashboard/intake"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View Intakes
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold">Recent Intake Submissions</h2>
          </div>
          {data.recentSubmissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No submissions yet. Create an intake form to start collecting
              client data.
            </div>
          ) : (
            <div className="divide-y">
              {data.recentSubmissions.map((sub) => (
                <Link
                  key={sub.id}
                  to="/dashboard/intake/$formId/submissions/$submissionId"
                  params={{ formId: sub.formId, submissionId: sub.id }}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {sub.summary.split("|")[0].trim()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(sub.createdAt, true)}
                    </p>
                  </div>
                  <span className="ml-2">
                    <StatusBadge status={sub.status} />
                  </span>
                </Link>
              ))}
            </div>
          )}
          {data.recentSubmissions.length > 0 && (
            <div className="border-t px-5 py-3">
              <Link
                to="/dashboard/intake"
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                View all submissions →
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-xl border">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold">Recent Documents</h2>
          </div>
          {data.recentDocs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No documents yet. Generate your first legal document.
            </div>
          ) : (
            <div className="divide-y">
              {data.recentDocs.map((doc) => (
                <Link
                  key={doc.id}
                  to="/dashboard/documents/$docId"
                  params={{ docId: doc.id }}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(doc.createdAt)}
                    </p>
                  </div>
                  <span className="ml-2">
                    <StatusBadge status={doc.status} />
                  </span>
                </Link>
              ))}
            </div>
          )}
          {data.recentDocs.length > 0 && (
            <div className="border-t px-5 py-3">
              <Link
                to="/dashboard/documents"
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                View all documents →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
