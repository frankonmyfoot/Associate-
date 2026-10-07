// Plan definitions — CLIENT-SAFE (no Stripe imports). Shared by the pricing
// page, settings, and gating copy. Dollar amounts here are marketing copy only
// (owner-confirmed 2026-06-17, ratified plan rev 2); app logic NEVER reads them
// — billing decisions come from the firm record + Stripe env price IDs.

export type PlanId = "starter" | "pro" | "enterprise";

export interface PlanLimits {
  users: number; // -1 = unlimited
  intakeSubmissionsPerMonth: number; // -1 = unlimited
  documentGenerationsPerMonth: number; // -1 = unlimited
}

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Marketing copy only — never read by app logic. */
  priceMonthlyUsd: number | null; // null = custom pricing
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthlyUsd: 49,
    limits: {
      users: 3,
      intakeSubmissionsPerMonth: 100,
      documentGenerationsPerMonth: 50,
    },
    features: [
      "Up to 3 users",
      "100 intake submissions / month",
      "50 document generations / month",
      "Smart intake forms with shareable client links",
      "AI document drafting (demand letters, contracts, pleadings)",
      "Auto case summaries into your dashboard",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 149,
    limits: {
      users: 15,
      intakeSubmissionsPerMonth: -1,
      documentGenerationsPerMonth: -1,
    },
    features: [
      "Up to 15 users",
      "Unlimited intake submissions",
      "Unlimited document generations",
      "Everything in Starter",
      "All six document types with regenerate",
      "Priority support",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceMonthlyUsd: null,
    limits: {
      users: -1,
      intakeSubmissionsPerMonth: -1,
      documentGenerationsPerMonth: -1,
    },
    features: [
      "Custom user counts",
      "White-label options",
      "Dedicated support",
      "Custom onboarding for your firm",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["starter", "pro", "enterprise"];

export function isUnlimited(n: number): boolean {
  return n === -1;
}

export function planName(plan: string): string {
  return PLANS[plan as PlanId]?.name ?? "Starter";
}
