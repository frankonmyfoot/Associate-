import { Link, createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/clerk-react";

import { getPublicConfig } from "~/lib/server";

export const Route = createFileRoute("/sign-up")({
  loader: async () => {
    try {
      const cfg = await getPublicConfig();
      return { clerkKey: cfg.clerkPublishableKey };
    } catch {
      return { clerkKey: null };
    }
  },
  component: SignUpPage,
});

function SignUpPage() {
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
        <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="w-full max-w-md rounded-xl border p-8 text-center">
          <h1 className="text-2xl font-bold">Create your firm account</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Account creation opens here as we onboard firms. While AssociateAI
            is in rollout, explore what the product does on the home page —
            smart intake forms and AI document drafting built for small firms.
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
