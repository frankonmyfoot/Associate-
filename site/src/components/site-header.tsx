import { Link } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";

/**
 * Public-site header. Clerk-aware when a publishable key exists (SignedIn/
 * SignedOut require the ClerkProvider mounted in __root); falls back to plain
 * sign-in/sign-up links otherwise so the site renders identically without
 * keys.
 */
export default function SiteHeader({ hasClerk }: { hasClerk: boolean }) {
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
          {hasClerk ? (
            <>
              <SignedOut>
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
              </SignedOut>
              <SignedIn>
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Dashboard
                </Link>
                <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
              </SignedIn>
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
