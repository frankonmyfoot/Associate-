import { createFileRoute } from "@tanstack/react-router";

import { getSettingsData } from "~/lib/server";

export const Route = createFileRoute("/dashboard/settings")({
  loader: async () => {
    try {
      return await getSettingsData();
    } catch {
      return { mode: "no-firm" as const };
    }
  },
  component: SettingsPage,
});

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  attorney: "bg-blue-100 text-blue-700",
  paralegal: "bg-green-100 text-green-700",
  staff: "bg-muted text-muted-foreground",
};

// Plan names only — dollar amounts come from the billing build (Stripe task);
// the confirmed prices are $49/mo Starter and $149/mo Pro.
const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

function SettingsPage() {
  const data = Route.useLoaderData();

  if (data.mode === "no-firm") {
    return (
      <div className="p-6 text-muted-foreground">
        Your account isn't linked to a firm yet. Complete onboarding first.
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your firm profile, team members, and subscription.
      </p>

      <div className="mt-8 space-y-6">
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Firm Profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Firm Name</label>
              <input
                type="text"
                readOnly
                disabled
                value={data.firm.name}
                className="mt-1 block w-full rounded-lg border bg-muted/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Plan</label>
              <input
                type="text"
                readOnly
                disabled
                value={PLAN_LABELS[data.firm.plan] ?? "Starter"}
                className="mt-1 block w-full rounded-lg border bg-muted/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Practice Areas</label>
              <textarea
                readOnly
                disabled
                value={data.firm.practiceAreas}
                rows={2}
                placeholder="Not specified"
                className="mt-1 block w-full rounded-lg border bg-muted/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Team Size</label>
              <input
                type="text"
                readOnly
                disabled
                value={data.firm.teamSize}
                placeholder="Not specified"
                className="mt-1 block w-full rounded-lg border bg-muted/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Firm ID</label>
              <input
                type="text"
                readOnly
                disabled
                value={data.firm.firmId}
                className="mt-1 block w-full rounded-lg border bg-muted/20 px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Usage</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-2xl font-bold">{data.usage.intakes}</p>
              <p className="text-xs text-muted-foreground">Intake Submissions</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-2xl font-bold">{data.usage.docs}</p>
              <p className="text-xs text-muted-foreground">Documents Generated</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 text-center">
              <p className="text-2xl font-bold">{data.usage.members}</p>
              <p className="text-xs text-muted-foreground">Team Members</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Team Members</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {data.members.length} member{data.members.length !== 1 ? "s" : ""}
            </span>
          </div>
          {data.members.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No team members found.
            </p>
          ) : (
            <div className="mt-4 divide-y">
              {data.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[member.role] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold">Plan &amp; Billing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You are on the <strong>{PLAN_LABELS[data.firm.plan] ?? "Starter"}</strong> plan.
            Upgrades will be available once billing is connected.
          </p>
          <div className="mt-4">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border px-4 py-2 text-sm font-medium opacity-50"
            >
              Upgrade (Coming Soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
