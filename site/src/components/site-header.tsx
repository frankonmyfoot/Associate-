import { Link, useRouter } from "@tanstack/react-router";
import { signOut, type SessionUser } from "~/lib/server";

/**
 * Public-site header. Server-rendered auth state arrives via the `user` prop
 * (each page's loader resolves the session); sign-out is a server-fn call
 * followed by a redirect home.
 */
export default function SiteHeader({ user }: { user?: SessionUser | null }) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Clearing the cookie matters more than the RPC result — navigate anyway.
    }
    await router.navigate({ to: "/" });
  };

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          <span className="text-xl font-bold">AssociateAI</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            to="/demo"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Live Demo
          </Link>
          <Link
            to="/pricing"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Pricing
          </Link>
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Link>
              <Link
                to="/sign-up"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
