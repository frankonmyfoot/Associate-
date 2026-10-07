/**
 * Stripe setup — creates the two subscription products + monthly prices and
 * prints the price IDs to save as platform secrets/env vars.
 *
 * Run ONCE (and only once keys exist): `bun run scripts/stripe-setup.ts`
 * Requires STRIPE_SECRET_KEY in the environment. Idempotent: products are
 * looked up by name, and a price is only created when the product has none
 * — so re-running never duplicates products or prices.
 *
 * Owner-ratified pricing (plan rev 2): Starter $49/mo, Pro $149/mo.
 * Save the printed values as STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO.
 */

import Stripe from "stripe";

const PRODUCTS: Array<{
  name: string;
  unitAmount: number;
  envVar: string;
}> = [
  { name: "AssociateAI Starter", unitAmount: 4900, envVar: "STRIPE_PRICE_STARTER" },
  { name: "AssociateAI Pro", unitAmount: 14900, envVar: "STRIPE_PRICE_PRO" },
];

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error(
      "STRIPE_SECRET_KEY is not set — connect the Stripe account first (via the platform Secrets page), then re-run.",
    );
    process.exit(1);
  }
  const stripe = new Stripe(key);

  for (const spec of PRODUCTS) {
    // Idempotent product lookup by name.
    const existing = await stripe.products.list({ limit: 100 });
    let product = existing.data.find((p) => p.name === spec.name);
    if (!product) {
      product = await stripe.products.create({
        name: spec.name,
        type: "service",
      });
      console.log(`created product: ${spec.name} (${product.id})`);
    } else {
      console.log(`product exists: ${spec.name} (${product.id})`);
    }

    // Idempotent price: reuse an existing monthly price on this product.
    const prices = await stripe.prices.list({ product: product.id, limit: 100 });
    const price = prices.data.find(
      (p) =>
        p.recurring?.interval === "month" &&
        p.unit_amount === spec.unitAmount &&
        p.currency === "usd" &&
        p.active,
    );
    if (price) {
      console.log(`price exists for ${spec.name}: ${price.id}`);
      console.log(`${spec.envVar}=${price.id}`);
    } else {
      const created = await stripe.prices.create({
        product: product.id,
        unit_amount: spec.unitAmount,
        currency: "usd",
        recurring: { interval: "month" },
      });
      console.log(`created monthly price for ${spec.name}: ${created.id}`);
      console.log(`${spec.envVar}=${created.id}`);
    }
  }

  console.log(
    "\nSave the printed price IDs as platform secrets: STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO.\nAlso required for full billing: STRIPE_SECRET_KEY (already set), STRIPE_WEBHOOK_SECRET (from the Stripe CLI/dashboard webhook config for POST /api/billing/webhook).",
  );
}

main().catch((err) => {
  console.error(
    "stripe-setup failed:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
