/**
 * Server-only Stripe billing (key-optional, mirroring the auth gating pattern).
 *
 * `process.env.STRIPE_SECRET_KEY` is read at CALL time — the platform injects
 * keys into the serving process env, which can change after process start.
 * Every billing operation returns a TYPED result instead of throwing when
 * billing is unconfigured, so pages never 500 and never leak stack traces.
 *
 * Client-safe plan copy lives in ~/lib/plans.ts (no Stripe imports there).
 */

import Stripe from "stripe";

// ─── Status ──────────────────────────────────────────────────

export type BillingConfigured =
  | { configured: false }
  | { configured: true };

export function billingConfigured(): BillingConfigured {
  return process.env.STRIPE_SECRET_KEY ? { configured: true } : { configured: false };
}

let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

// ─── Price ID mapping ────────────────────────────────────────

export type PurchasablePlan = "starter" | "pro";

export function priceIdFor(plan: PurchasablePlan): string | null {
  const raw =
    plan === "pro"
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_STARTER;
  return raw ? raw.trim() || null : null;
}

/** Maps a Stripe price ID back to a plan; null when it matches neither env ID. */
export function planForPriceId(priceId: string | undefined | null): PurchasablePlan | null {
  if (!priceId) return null;
  if (priceId === (process.env.STRIPE_PRICE_PRO ?? "").trim()) return "pro";
  if (priceId === (process.env.STRIPE_PRICE_STARTER ?? "").trim()) return "starter";
  return null;
}

// ─── Checkout ────────────────────────────────────────────────

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unconfigured" | "missing-price-id" | "stripe-error"; message: string };

export async function createCheckoutSession(opts: {
  firmId: string;
  firmName: string;
  customerEmail: string;
  plan: PurchasablePlan;
  origin: string;
  existingCustomerId: string | null;
}): Promise<CheckoutResult> {
  if (!billingConfigured().configured) {
    return {
      ok: false,
      reason: "unconfigured",
      message: "Billing is coming online — the Stripe account isn't connected yet.",
    };
  }
  const priceId = priceIdFor(opts.plan);
  if (!priceId) {
    return {
      ok: false,
      reason: "missing-price-id",
      message: `Billing isn't fully configured yet — the ${opts.plan} price ID (STRIPE_PRICE_${opts.plan.toUpperCase()}) hasn't been set.`,
    };
  }
  const stripe = getStripe()!;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(opts.existingCustomerId
        ? { customer: opts.existingCustomerId }
        : { customer_email: opts.customerEmail || undefined }),
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: opts.firmId,
      metadata: { firmId: opts.firmId, plan: opts.plan },
      subscription_data: { metadata: { firmId: opts.firmId, plan: opts.plan } },
      success_url: `${opts.origin}/dashboard/settings?billing=success`,
      cancel_url: `${opts.origin}/pricing`,
    });
    // Remember the customer on the firm immediately (works for both the
    // reused and the ad-hoc-created customer), so the portal has an anchor
    // even if the webhook is delayed.
    if (typeof session.customer === "string" && session.customer) {
      const { execute } = await import("./db");
      await execute(
        `UPDATE firms SET stripe_customer_id = '${session.customer.replace(/'/g, "''")}', updated_at = datetime('now') WHERE id = '${opts.firmId.replace(/'/g, "''")}'`,
      );
    }
    if (!session.url) {
      return { ok: false, reason: "stripe-error", message: "Stripe didn't return a checkout URL." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("Stripe checkout error:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "stripe-error", message: "Stripe checkout couldn't be started. Please try again later." };
  }
}

// ─── Customer portal ─────────────────────────────────────────

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; reason: "unconfigured" | "no-customer" | "stripe-error"; message: string };

export async function createPortalSession(opts: {
  customerId: string | null;
  origin: string;
}): Promise<PortalResult> {
  if (!billingConfigured().configured) {
    return {
      ok: false,
      reason: "unconfigured",
      message: "Billing is coming online — the Stripe account isn't connected yet.",
    };
  }
  if (!opts.customerId) {
    return {
      ok: false,
      reason: "no-customer",
      message: "No billing profile yet — subscribe to a plan first.",
    };
  }
  const stripe = getStripe()!;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: opts.customerId,
      return_url: `${opts.origin}/dashboard/settings`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("Stripe portal error:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "stripe-error", message: "Stripe's billing portal couldn't be opened. Please try again later." };
  }
}

// ─── Webhook verification + dispatch ─────────────────────────

export type WebhookResult =
  | { handled: true }
  | { handled: false; status: number; message: string };

/**
 * Verifies the Stripe signature over the RAW request body and syncs the
 * affected firm's plan + subscription status. Called from the raw
 * /api/billing/webhook endpoint intercepted in serve.ts (signature
 * verification needs the exact bytes the gateway received — parsed JSON won't do).
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookResult> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return {
      handled: false,
      status: 503,
      message: "Webhooks aren't configured on this deployment yet (STRIPE_WEBHOOK_SECRET missing).",
    };
  }
  if (!signature) {
    return { handled: false, status: 400, message: "Missing Stripe signature header." };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      handled: false,
      status: 503,
      message: "Webhooks can't be processed — STRIPE_SECRET_KEY isn't connected yet.",
    };
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err instanceof Error ? err.message : err);
    return { handled: false, status: 400, message: "Webhook signature verification failed." };
  }

  try {
    const { execute, query } = await import("./db");
    const esc = (s: string) => s.replace(/'/g, "''");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const firmId = session.metadata?.firmId || session.client_reference_id || "";
        const plan = session.metadata?.plan;
        if (firmId) {
          const customerId = typeof session.customer === "string" ? session.customer : null;
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
          let periodEnd: string | null = null;
          let subStatus: string | null = null;
          if (subscriptionId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subscriptionId);
              subStatus = sub.status;
              periodEnd = sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null;
            } catch (err) {
              console.error("Webhook: subscription retrieve failed:", err instanceof Error ? err.message : err);
            }
          }
          await execute(
            `UPDATE firms SET
               stripe_customer_id = ${customerId ? `'${esc(customerId)}'` : "COALESCE(stripe_customer_id, NULL)"},
               subscription_status = ${subStatus ? `'${esc(subStatus)}'` : "COALESCE(subscription_status, NULL)"},
               current_period_end = ${periodEnd ? `'${esc(periodEnd)}'` : "COALESCE(current_period_end, NULL)"},
               ${plan ? `plan = '${esc(plan)}',` : ""}
               updated_at = datetime('now')
             WHERE id = '${esc(firmId)}'`,
          );
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : "";
        // Locate the firm via metadata first (set at checkout), then by customer id.
        let firmId: string | null = sub.metadata?.firmId ?? null;
        if (!firmId && customerId) {
          const rows = await query<{ id: string }>(
            `SELECT id FROM firms WHERE stripe_customer_id = '${esc(customerId)}' LIMIT 1`,
          );
          firmId = rows[0]?.id ?? null;
        }
        if (firmId) {
          const priceId = sub.items?.data?.[0]?.price?.id ?? null;
          const plan = planForPriceId(priceId);
          const periodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          // On deletion, keep the last plan but mark the subscription ended.
          const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
          await execute(
            `UPDATE firms SET
               ${plan && event.type === "customer.subscription.updated" ? `plan = '${esc(plan)}',` : ""}
               subscription_status = '${esc(status)}',
               current_period_end = ${periodEnd ? `'${esc(periodEnd)}'` : "NULL"},
               updated_at = datetime('now')
             WHERE id = '${esc(firmId)}'`,
          );
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }

    return { handled: true };
  } catch (err) {
    console.error("Stripe webhook handling error:", err instanceof Error ? err.message : err);
    return {
      handled: false,
      status: 500,
      message: "Webhook received but couldn't be applied — Stripe will retry.",
    };
  }
}
