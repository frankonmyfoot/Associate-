import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";

import SiteHeader from "~/components/site-header";
import { getBillingConfig, getPublicConfig, startCheckout } from "~/lib/server";
import { PLANS, PLAN_ORDER } from "~/lib/plans";

export const Route = createFileRoute("/pricing")({
  loader: async () => {
    try {
      const [cfg, billing] = await Promise.all([
        getPublicConfig(),
        getBillingConfig(),
      ]);
      return {
        hasClerk: Boolean(cfg.clerkPublishableKey),
        billingConfigured: billing.configured,
        firmPlan: billing.plan,
      };
    } catch {
      return {
        hasClerk: false,
        billingConfigured: false,
        firmPlan: null,
      };
    }
  },
  component: PricingPage,
});

function PricingPage() {
  const data = Route.useLoaderData();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader hasClerk={data.hasClerk} />

      <section className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight">Simple pricing</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Monthly subscriptions for solo practitioners and small firms.
              Cancel anytime from your billing portal.
            </p>
          </div>

          {/* The plan grid always renders (public marketing); only the
              checkout interaction is Clerk-gated — useUser() throws without a
              provider, so it lives in a component mounted only when keys exist. */}
          <PricingPlanGrid
            hasClerk={data.hasClerk}
            billingConfigured={data.billingConfigured}
            firmPlan={data.firmPlan}
          />
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AssociateAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function PricingPlanGrid({
  hasClerk,
  billingConfigured,
  firmPlan,
}: {
  hasClerk: boolean;
  billingConfigured: boolean;
  firmPlan: string | null;
}) {
  const [checkoutError, setCheckoutError] = useState("");

  return (
    <>
      {checkoutError && (
        <p className="mx-auto mt-6 max-w-xl rounded-lg border bg-yellow-50 px-4 py-3 text-center text-sm text-yellow-800">
          {checkoutError}
        </p>
      )}

      <div className="mt-12 grid gap-8 md:grid-cols-3">
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const highlighted = planId === "pro";
              const isCurrent = firmPlan === planId;

              return (
                <div
                  key={planId}
                  className={`relative flex flex-col rounded-xl border p-6 ${
                    highlighted ? "border-primary-600 shadow-md" : ""
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-3 py-0.5 text-xs font-medium text-white">
                      Most Popular
                    </span>
                  )}
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  <p className="mt-2">
                    {plan.priceMonthlyUsd == null ? (
                      <span className="text-3xl font-bold">Custom</span>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">
                          ${plan.priceMonthlyUsd}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                      </>
                    )}
                  </p>
                  <ul className="mt-6 flex-1 space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {isCurrent ? (
                      <span className="block rounded-lg border bg-muted/40 px-4 py-2 text-center text-sm font-medium text-muted-foreground">
                        Your current plan
                      </span>
                    ) : planId === "enterprise" ? (
                      <Link
                        to="/"
                        className="block rounded-lg border px-4 py-2 text-center text-sm font-medium hover:bg-muted"
                      >
                        Contact Us
                      </Link>
                    ) : billingConfigured && hasClerk ? (
                      <SubscribeButton
                        plan={planId as "starter" | "pro"}
                        label={`Subscribe to ${plan.name}`}
                        onError={setCheckoutError}
                      />
                    ) : billingConfigured ? (
                      <Link
                        to="/sign-up"
                        className="block rounded-lg bg-primary-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-700"
                      >
                        Sign up to subscribe
                      </Link>
                    ) : (
                      <div className="text-center">
                        <Link
                          to="/sign-up"
                          className="block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                        >
                          Get Started
                        </Link>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Billing is coming online — checkout opens as soon as
                          the Stripe account is connected.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Starter renews monthly at $49; Pro at $149. Subscriptions are
        managed by Stripe — upgrades, downgrades, and cancellation happen
        in your firm's billing portal.{" "}
        {firmPlan && (
          <Link
            to="/dashboard/settings"
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            Manage your plan →
          </Link>
        )}
      </p>
    </>
  );
}

/** Mounted ONLY when a ClerkProvider exists (uses useUser). */
function SubscribeButton({
  plan,
  label,
  onError,
}: {
  plan: "starter" | "pro";
  label: string;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const { user } = useUser();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    onError("");
    if (!user) {
      await router.navigate({ to: "/sign-up" });
      return;
    }
    setBusy(true);
    try {
      const result = await startCheckout({
        data: {
          plan,
          userEmail: user.primaryEmailAddress?.emailAddress ?? "",
        },
      });
      if (result.ok) {
        window.location.href = result.url;
      } else {
        onError(result.message);
        setBusy(false);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Checkout couldn't be started.");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
    >
      {busy ? "Starting checkout..." : label}
    </button>
  );
}
