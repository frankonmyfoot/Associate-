import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/db-client";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session.userId) {
    return <div className="p-6">Please sign in to view the dashboard.</div>;
  }

  // Get user's firm
  const users = await query<{ firm_id: string; name: string }>(
    `SELECT firm_id, name FROM firm_users WHERE clerk_user_id = '${session.userId.replace(/'/g, "''")}'`
  );
  if (!users.length) {
    return <div className="p-6">No firm found. Please complete onboarding.</div>;
  }

  const firmId = users[0].firm_id;
  const userName = users[0].name;

  // Get intake stats
  const pendingIntakes = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM intake_submissions WHERE firm_id = '${firmId.replace(/'/g, "''")}' AND status = 'pending'`
  );
  const reviewedIntakes = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM intake_submissions WHERE firm_id = '${firmId.replace(/'/g, "''")}' AND status = 'reviewed'`
  );
  const allIntakes = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM intake_submissions WHERE firm_id = '${firmId.replace(/'/g, "''")}'`
  );

  // Get document stats
  const draftDocs = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM document_drafts WHERE firm_id = '${firmId.replace(/'/g, "''")}' AND status = 'draft'`
  );
  const finalizedDocs = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM document_drafts WHERE firm_id = '${firmId.replace(/'/g, "''")}' AND status = 'finalized'`
  );

  // Get intake forms count
  const intakeForms = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM intake_forms WHERE firm_id = '${firmId.replace(/'/g, "''")}'`
  );

  // Recent activity — last 5 submissions
  const recentSubmissions = await query<Record<string, unknown>>(
    `SELECT id, form_id, status, case_summary, created_at
     FROM intake_submissions WHERE firm_id = '${firmId.replace(/'/g, "''")}'
     ORDER BY created_at DESC LIMIT 5`
  );

  // Recent documents
  const recentDocs = await query<Record<string, unknown>>(
    `SELECT id, title, document_type, status, created_at
     FROM document_drafts WHERE firm_id = '${firmId.replace(/'/g, "''")}'
     ORDER BY created_at DESC LIMIT 5`
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Here&apos;s your firm&apos;s overview.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-5">
          <p className="text-sm font-medium text-muted-foreground">
            Intake Forms
          </p>
          <p className="mt-2 text-3xl font-bold">
            {String(intakeForms[0]?.count ?? "0")}
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <p className="text-sm font-medium text-muted-foreground">
            Pending Intakes
          </p>
          <p className="mt-2 text-3xl font-bold text-yellow-600">
            {String(pendingIntakes[0]?.count ?? "0")}
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <p className="text-sm font-medium text-muted-foreground">
            Draft Documents
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {String(draftDocs[0]?.count ?? "0")}
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <p className="text-sm font-medium text-muted-foreground">
            Finalized
          </p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {String(finalizedDocs[0]?.count ?? "0")}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/dashboard/intake/new"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            + New Intake Form
          </Link>
          <Link
            href="/dashboard/documents/new"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            + Generate Document
          </Link>
          <Link
            href="/dashboard/intake"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            View Intakes
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent Submissions */}
        <div className="rounded-xl border">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold">Recent Intake Submissions</h2>
          </div>
          {recentSubmissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No submissions yet. Create an intake form to start collecting client data.
            </div>
          ) : (
            <div className="divide-y">
              {recentSubmissions.map((sub) => (
                <Link
                  key={sub.id as string}
                  href={`/dashboard/intake/${sub.form_id}/submissions/${sub.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {sub.case_summary
                        ? String(sub.case_summary).split("|")[0].trim()
                        : "Submission"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sub.created_at
                        ? new Date(String(sub.created_at)).toLocaleDateString()
                        : ""}
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
                </Link>
              ))}
            </div>
          )}
          {recentSubmissions.length > 0 && (
            <div className="border-t px-5 py-3">
              <Link
                href="/dashboard/intake"
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                View all submissions &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Recent Documents */}
        <div className="rounded-xl border">
          <div className="border-b px-5 py-3">
            <h2 className="font-semibold">Recent Documents</h2>
          </div>
          {recentDocs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No documents yet. Generate your first legal document.
            </div>
          ) : (
            <div className="divide-y">
              {recentDocs.map((doc) => (
                <Link
                  key={doc.id as string}
                  href={`/dashboard/documents/${doc.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {String(doc.title ?? "Untitled")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {doc.created_at
                        ? new Date(String(doc.created_at)).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      String(doc.status) === "finalized"
                        ? "bg-green-100 text-green-700"
                        : String(doc.status) === "archived"
                          ? "bg-muted text-muted-foreground"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {String(doc.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {recentDocs.length > 0 && (
            <div className="border-t px-5 py-3">
              <Link
                href="/dashboard/documents"
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                View all documents &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}