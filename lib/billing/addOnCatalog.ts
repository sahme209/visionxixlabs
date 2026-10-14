/**
 * Add-on catalog — Phase 386.
 *
 * Source-of-truth for purchasable top-ups. The DB ledger
 * (AddOnPurchase) records the workspace transaction; the catalog
 * lives in code so we can ship + tune SKUs without a migration.
 *
 * Three categories: AI credit packs, seat packs, connector packs.
 * Add credits roll off at month boundary (validFor="current_month");
 * seats + connectors persist (validFor="permanent") so a one-time
 * purchase keeps applying month after month.
 *
 * Pricing intent: customer price is twice the provider-cost budget
 * credited to the workspace. Keeping the sale price and delivered
 * budget separate makes the 2x gross-margin invariant explicit.
 */

import type { PricingPlan, PlanTier } from "./planRegistry";

export type AddOnCategory = "ai_credits" | "seats" | "connectors";
export type AddOnValidity = "current_month" | "permanent";

export interface AddOnPackageDef {
  sku: string;
  displayName: string;
  category: AddOnCategory;
  /** Operator-facing one-liner. */
  tagline: string;
  priceCents: number;
  /** Delivered AI credits in cents (USD). 0 when category !== "ai_credits". */
  deliveredAICreditsCents: number;
  /** Extra seats. 0 when category !== "seats". */
  deliveredSeats: number;
  /** Extra connectors. 0 when category !== "connectors". */
  deliveredConnectors: number;
  validFor: AddOnValidity;
  /** Which plan tiers can buy this. Enterprise is always allowed; the array gates non-enterprise. */
  allowedTiers: ReadonlyArray<PlanTier>;
}

const AI_CREDITS_SMALL: AddOnPackageDef = {
  sku: "ai_credits_small",
  displayName: "AI credits · small",
  category: "ai_credits",
  tagline: "Add $5 of provider-cost budget for the current month.",
  priceCents: 1000,                  // $10
  deliveredAICreditsCents: 500,      // $5 provider-cost budget
  deliveredSeats: 0,
  deliveredConnectors: 0,
  validFor: "current_month",
  allowedTiers: ["starter", "growth", "business"],
};

const AI_CREDITS_MEDIUM: AddOnPackageDef = {
  sku: "ai_credits_medium",
  displayName: "AI credits · medium",
  category: "ai_credits",
  tagline: "Add $20 of provider-cost budget for the current month.",
  priceCents: 4000,                  // $40
  deliveredAICreditsCents: 2000,     // $20 provider-cost budget
  deliveredSeats: 0,
  deliveredConnectors: 0,
  validFor: "current_month",
  allowedTiers: ["starter", "growth", "business"],
};

const AI_CREDITS_LARGE: AddOnPackageDef = {
  sku: "ai_credits_large",
  displayName: "AI credits · large",
  category: "ai_credits",
  tagline: "Add $75 of provider-cost budget for the current month.",
  priceCents: 15000,                 // $150
  deliveredAICreditsCents: 7500,     // $75 provider-cost budget
  deliveredSeats: 0,
  deliveredConnectors: 0,
  validFor: "current_month",
  allowedTiers: ["growth", "business"],
};

const SEAT_ADDON: AddOnPackageDef = {
  sku: "seat_addon",
  displayName: "Extra seat",
  category: "seats",
  tagline: "One extra user seat — billed monthly until cancelled.",
  priceCents: 2000,                  // $20 / mo
  deliveredAICreditsCents: 0,
  deliveredSeats: 1,
  deliveredConnectors: 0,
  validFor: "permanent",             // monthly subscription line item (kept active)
  allowedTiers: ["starter", "growth", "business"],
};

const CONNECTOR_ADDON: AddOnPackageDef = {
  sku: "connector_addon",
  displayName: "Extra connector",
  category: "connectors",
  tagline: "One extra third-party connector — billed monthly until cancelled.",
  priceCents: 3000,                  // $30 / mo
  deliveredAICreditsCents: 0,
  deliveredSeats: 0,
  deliveredConnectors: 1,
  validFor: "permanent",
  allowedTiers: ["starter", "growth", "business"],
};

export const ADD_ON_CATALOG: ReadonlyArray<AddOnPackageDef> = [
  AI_CREDITS_SMALL,
  AI_CREDITS_MEDIUM,
  AI_CREDITS_LARGE,
  SEAT_ADDON,
  CONNECTOR_ADDON,
];

export function findAddOn(sku: string): AddOnPackageDef | null {
  return ADD_ON_CATALOG.find((a) => a.sku === sku) ?? null;
}

/**
 * Returns the catalog filtered to add-ons the given plan can purchase.
 * Enterprise sees the full catalog (custom contracts may use these
 * skus as discount-pricing references).
 */
export function findAddOnsForPlan(plan: PricingPlan): ReadonlyArray<AddOnPackageDef> {
  if (plan.tier === "enterprise") return ADD_ON_CATALOG;
  return ADD_ON_CATALOG.filter((a) => a.allowedTiers.includes(plan.tier));
}
