import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/clerk-react";
import type { ReactNode } from "react";

import { getPublicConfig } from "~/lib/server";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AssociateAI — AI-Powered Legal Intake & Document Generation" },
      {
        name: "description",
        content:
          "Handle client intake and document generation faster with AI. Designed for solo practitioners and small-to-mid-size law firms.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  // The Clerk publishable key is resolved server-side at REQUEST time (the
  // platform injects keys into the serving process env), then passed to
  // ClerkProvider as a prop through the SSR'd loader data — so the client
  // bundle never needs build-time env access. Key-optional: without a key we
  // render the app without Clerk (honest placeholder states on auth pages).
  loader: async () => {
    try {
      const cfg = await getPublicConfig();
      return { clerkPublishableKey: cfg.clerkPublishableKey };
    } catch {
      return { clerkPublishableKey: null };
    }
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-2xl font-bold">Page not found</p>
      <p className="text-sm text-muted-foreground">
        That page doesn't exist. Head back to the home page to learn about
        AssociateAI.
      </p>
      <Link
        to="/"
        className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        Back to Home
      </Link>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  const { clerkPublishableKey } = Route.useLoaderData();

  return (
    <RootDocument>
      {clerkPublishableKey ? (
        <ClerkProvider publishableKey={clerkPublishableKey}>
          <Outlet />
        </ClerkProvider>
      ) : (
        <Outlet />
      )}
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
