import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { getSessionUser, signUp } from "~/lib/server";

export const Route = createFileRoute("/sign-up")({
  loader: async () => {
    const user = await getSessionUser().catch(() => null);
    if (user) {
      throw redirect({ to: user.firmId ? "/dashboard" : "/onboarding" });
    }
    return {};
  },
  component: SignUpPage,
});

function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await signUp({ data: { name, email, password } });
      await router.navigate({ to: result.redirect });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the account.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <section className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">Create your firm account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Takes under a minute — next you'll set up your firm's workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Your name{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="you@yourfirm.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {busy ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/sign-in"
              className="font-medium text-primary-600 hover:text-primary-700"
            >
              Sign in
            </Link>
          </p>
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
