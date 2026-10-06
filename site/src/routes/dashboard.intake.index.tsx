import { Link, createFileRoute } from "@tanstack/react-router";

import { EmptyState, StatusBadge } from "~/components/ui";
import { fmtDate } from "~/lib/fmt";
import { listIntakeForms } from "~/lib/server";

export const Route = createFileRoute("/dashboard/intake/")({
  loader: async () => {
    try {
      return await listIntakeForms();
    } catch {
      return { mode: "no-firm" as const, forms: [] };
    }
  },
  component: IntakePage,
});

const EMPTY_ICON =
  "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-1.125 1.125-1.125V11.25a9 9 0 00-9-9z";

function IntakePage() {
  const data = Route.useLoaderData();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Intake</h1>
          <p className="mt-1 text-muted-foreground">
            Manage intake forms and view client submissions.
          </p>
        </div>
        <Link
          to="/dashboard/intake/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New Intake Form
        </Link>
      </div>

      {data.forms.length === 0 ? (
        <EmptyState
          title="No intake forms yet"
          message="Create your first intake form to start collecting client information seamlessly."
          iconPath={EMPTY_ICON}
          action={{ to: "/dashboard/intake/new", label: "Create Intake Form" }}
        />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.forms.map((form) => (
            <Link
              key={form.id}
              to="/dashboard/intake/$formId"
              params={{ formId: form.id }}
              className="rounded-xl border p-5 transition-all hover:border-primary-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{form.title}</h3>
                <span className="ml-2">
                  <StatusBadge status={form.isActive ? "active" : "inactive"} />
                </span>
              </div>
              {form.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {form.description}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {form.fieldCount} field(s) · {form.submissionCount} submission
                {form.submissionCount !== 1 ? "s" : ""} · {fmtDate(form.createdAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
