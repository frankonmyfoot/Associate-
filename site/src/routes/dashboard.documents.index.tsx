import { Link, createFileRoute } from "@tanstack/react-router";

import { EmptyState, StatusBadge } from "~/components/ui";
import { fmtDate } from "~/lib/fmt";
import { listDocuments } from "~/lib/server";

export const Route = createFileRoute("/dashboard/documents/")({
  loader: async () => {
    try {
      return await listDocuments();
    } catch {
      return { mode: "no-firm" as const, docs: [] };
    }
  },
  component: DocumentsPage,
});

const TYPE_LABELS: Record<string, string> = {
  "demand-letter": "Demand Letter",
  contract: "Contract / Agreement",
  pleading: "Pleading",
  "settlement-agreement": "Settlement Agreement",
  "legal-memo": "Legal Memo",
  "engagement-letter": "Engagement Letter",
};

const EMPTY_ICON =
  "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10";

function DocumentsPage() {
  const data = Route.useLoaderData();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            Generate and manage legal documents with AI.
          </p>
        </div>
        <Link
          to="/dashboard/documents/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New Document
        </Link>
      </div>

      {data.docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          message="Generate your first legal document — demand letters, contracts, pleadings, and more."
          iconPath={EMPTY_ICON}
          action={{
            to: "/dashboard/documents/new",
            label: "Generate Document",
          }}
        />
      ) : (
        <div className="mt-6 space-y-3">
          {data.docs.map((doc) => (
            <Link
              key={doc.id}
              to="/dashboard/documents/$docId"
              params={{ docId: doc.id }}
              className="block rounded-xl border p-4 transition-all hover:border-primary-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{doc.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {TYPE_LABELS[doc.documentType] ?? doc.documentType} ·{" "}
                    {fmtDate(doc.updatedAt || doc.createdAt)}
                  </p>
                </div>
                <StatusBadge status={doc.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
