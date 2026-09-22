import { auth } from "@clerk/nextjs/server";
import { query } from "@/lib/db-client";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await auth();
  if (!session.userId) {
    return <div className="p-6 text-red-600">Not authenticated</div>;
  }

  // Get firm info
  const firms = await query<Record<string, unknown>>(
    `SELECT f.* FROM firms f
     JOIN firm_users fu ON fu.firm_id = f.id
     WHERE fu.clerk_user_id = '${session.userId.replace(/'/g, "''")}'`
  );
  const firm = firms[0] ?? null;

  // Get team members
  const teamMembers = await query<Record<string, unknown>>(
    `SELECT id, email, name, role, created_at
     FROM firm_users WHERE firm_id = '${firm?.id ? String(firm.id).replace(/'/g, "''") : ""}'
     ORDER BY created_at ASC`
  );

  // Get counts
  const intakeCount = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM intake_submissions WHERE firm_id = '${firm?.id ? String(firm.id).replace(/'/g, "''") : ""}'`
  );
  const docCount = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM document_drafts WHERE firm_id = '${firm?.id ? String(firm.id).replace(/'/g, "''") : ""}'`
  );

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    attorney: "bg-blue-100 text-blue-700",
    paralegal: "bg-green-100 text-green-700",
    staff: "bg-muted text-muted-foreground",
  };

  const planLabels: Record<string, string> = {
    starter: "Starter — Free",
    pro: "Pro — $99/mo",
    enterprise: "Enterprise — Custom",
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your firm profile, team members, and subscription.
      </p>

      <div className="mt-8 space-y-6">
        {/* Firm Profile */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Firm Profile</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Firm Name</label>
              <input
                type="text"
                defaultValue={firm?.name ? String(firm.name) : ""}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm bg-muted/20"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Plan</label>
              <input
                type="text"
                defaultValue={planLabels[String(firm?.plan ?? "starter")] ?? "Starter"}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm bg-muted/20"
                disabled
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Practice Areas</label>
              <textarea
                defaultValue={firm?.practice_areas ? String(firm.practice_areas) : ""}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm bg-muted/20"
                rows={2}
                disabled
                placeholder="Not specified"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Team Size</label>
              <input
                type="text"
                defaultValue={firm?.team_size ? String(firm.team_size) : ""}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm bg-muted/20"
                disabled
                placeholder="Not specified"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Firm ID</label>
              <input
                type="text"
                defaultValue={firm?.id ? String(firm.id) : ""}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm bg-muted/20 font-mono text-xs"
                disabled
              />
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Usage</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-2xl font-bold">{String(intakeCount[0]?.count ?? "0")}</p>
              <p className="text-xs text-muted-foreground">Intake Submissions</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-2xl font-bold">{String(docCount[0]?.count ?? "0")}</p>
              <p className="text-xs text-muted-foreground">Documents Generated</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-2xl font-bold">{String(teamMembers.length)}</p>
              <p className="text-xs text-muted-foreground">Team Members</p>
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Team Members</h2>
            <span className="text-sm text-muted-foreground">{teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}</span>
          </div>

          {teamMembers.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No team members found.</p>
          ) : (
            <div className="mt-4 divide-y">
              {teamMembers.map((member) => {
                const memberName = member.name ? String(member.name) : "Unknown";
                const memberEmail = member.email ? String(member.email) : "";
                const memberRole = member.role ? String(member.role) : "staff";

                return (
                  <div key={member.id as string} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{memberName}</p>
                      <p className="text-xs text-muted-foreground">{memberEmail}</p>
                    </div>
                    <span
                      className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        roleColors[memberRole] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {memberRole}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Subscription */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You are currently on the <strong>Starter</strong> plan.
          </p>
          <div className="mt-4">
            <button
              disabled
              className="rounded-lg border px-4 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
            >
              Upgrade to Pro (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}