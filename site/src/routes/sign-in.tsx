import { Link, createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@clerk/clerk-react";

import { getPublicConfig } from "~/lib/server";

export const Route = createFileRoute("/sign-in")({
  loader: async () => {
    try {
      const cfg = await getPublicConfig();
      return { clerkKey: cfg.clerkPublishableKey };
    } catch {
      return { clerkKey: null };
    }
  },
  component: SignInPage,
});

function SignInPage() {
  const { clerkKey } = Route.useLoaderData();

  if (clerkKey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          <span className="text-xl font-bold">AssociateAI</span>
        </Link>
        <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="w-full max-w-md rounded-xl border p-8 text-center">
          <h1 className="text-2xl font-bold">Sign in to AssociateAI</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Firm authentication isn't configured on this deployment yet — the
            Clerk keys haven't been connected. Once they are, the real sign-in
            opens right here. No account exists behind this page yet.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          <span className="text-xl font-bold">AssociateAI</span>
        </Link>
      </div>
    </header>
  );
}
