import { Link, createFileRoute } from "@tanstack/react-router";

import SiteHeader from "~/components/site-header";
import { getPublicConfig } from "~/lib/server";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const cfg = await getPublicConfig();
      return { hasClerk: Boolean(cfg.clerkPublishableKey) };
    } catch {
      return { hasClerk: false };
    }
  },
  component: Home,
});

function Home() {
  const { hasClerk } = Route.useLoaderData();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader hasClerk={hasClerk} />

      {/* Hero */}
      <section className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your AI-Powered{" "}
              <span className="text-primary-600">Legal Assistant</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Automate client intake and document generation — from demand
              letters to contracts — so you can focus on practicing law, not
              paperwork.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                to="/sign-up"
                className="rounded-lg bg-primary-600 px-8 py-3 text-sm font-medium text-white hover:bg-primary-700"
              >
                Start Free Trial
              </Link>
              <a
                href="#features"
                className="rounded-lg border px-8 py-3 text-sm font-medium hover:bg-muted"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold">
            Everything your firm needs
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                <svg
                  className="h-6 w-6 text-primary-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Smart Intake Forms</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Customizable intake forms that auto-summarize into structured
                case files. Clients fill online, you get organized data
                instantly.
              </p>
            </div>
            <div className="rounded-xl border p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent-100">
                <svg
                  className="h-6 w-6 text-accent-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">AI Document Drafting</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Generate demand letters, contracts, and pleadings from simple
                prompts. Cut document prep time from hours to minutes.
              </p>
            </div>
            <div className="rounded-xl border p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Secure & Compliant</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Enterprise-grade security with multi-tenant isolation. Your data
                is encrypted at rest and in transit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} AssociateAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
