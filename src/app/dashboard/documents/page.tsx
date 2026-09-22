import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/db-client";
import Link from "next/link";

export default async function DocumentsPage() {
  const session = await auth();
  let docs: Record<string, unknown>[] = [];

  if (session.userId) {
    const users = await query<{ firm_id: string }>(
      `SELECT firm_id FROM firm_users WHERE clerk_user_id = '${session.userId.replace(/'/g, "''")}'`
    );
    if (users.length) {
      docs = await query<Record<string, unknown>>(
        `SELECT id, title, document_type, status, created_at, updated_at
         FROM document_drafts WHERE firm_id = '${users[0].firm_id.replace(/'/g, "''")}'
         ORDER BY updated_at DESC`
      );
    }
  }

  const typeLabels: Record<string, string> = {
    "demand-letter": "Demand Letter",
    contract: "Contract / Agreement",
    pleading: "Pleading",
    "settlement-agreement": "Settlement Agreement",
    "legal-memo": "Legal Memo",
    "engagement-letter": "Engagement Letter",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-700",
    finalized: "bg-green-100 text-green-700",
    archived: "bg-muted text-muted-foreground",
  };

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
          href="/dashboard/documents/new"
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New Document
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="mt-8 rounded-xl border p-12 text-center text-muted-foreground">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold">No documents yet</h3>
          <p className="mt-2 text-sm">
            Generate your first legal document — demand letters, contracts,
            pleadings, and more.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {docs.map((doc) => (
            <Link
              key={doc.id as string}
              href={`/dashboard/documents/${doc.id}`}
              className="block rounded-xl border p-4 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{doc.title as string}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {typeLabels[doc.document_type as string] ?? (doc.document_type as string)} &middot;{" "}
                    {new Date(doc.created_at as string).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    statusColors[doc.status as string] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {doc.status as string}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}