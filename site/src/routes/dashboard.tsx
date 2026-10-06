import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import { UserButton } from "@clerk/clerk-react";

import DashboardNav from "~/components/dashboard-nav";
import { GatePanel } from "~/components/ui";
import { getDashboardAuthState } from "~/lib/server";

export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    const state = await getDashboardAuthState();
    if (state.mode === "signed-out") {
      throw redirect({ to: "/sign-in" });
    }
    return state;
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const state = Route.useLoaderData();

  if (state.mode === "no-keys") {
    return (
      <GatePanel
        title="Authentication not configured yet"
        message="This deployment doesn't have Clerk keys connected, so firm accounts can't sign in yet. Everything else on the site still works — once the owner connects Clerk keys, the full dashboard opens here with no code changes."
      >
        <Link
          to="/"
          className="inline-block rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Back to Home
        </Link>
      </GatePanel>
    );
  }

  if (state.mode === "no-firm") {
    return (
      <GatePanel
        title="One more step"
        message="Your account is signed in, but it isn't linked to a firm workspace yet. Complete onboarding to set up your firm."
      >
        <Link
          to="/onboarding"
          className="inline-block rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Set up your firm
        </Link>
      </GatePanel>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r bg-muted/30">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-lg font-bold text-white">A</span>
            </div>
            <div className="min-w-0">
              <span className="block max-w-[140px] truncate text-sm font-bold">
                {state.firmName || "My Firm"}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                AssociateAI
              </span>
            </div>
          </Link>
        </div>
        <DashboardNav />
        <div className="border-t p-4">
          <Link
            to="/dashboard/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
              state.userName
                ? "text-muted-foreground hover:bg-muted"
                : "text-muted-foreground"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b px-6">
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
