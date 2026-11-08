/**
 * Add-on catalog — Phase 386.
 *
 * Source-of-truth for purchasable top-ups. The DB ledger
 * (AddOnPurchase) records the workspace transaction; the catalog
 * lives in code so we can ship + tune SKUs without a migration.
 *
 * Three categories: AI credit packs, seat packs, connector packs.
 * Prepaid AI credits never expire (validFor="permanent", user decision
 * 2026-11-08); seats + connectors also persist (validFor="permanent").
 *
 * Pricing intent: one versioned rate card (`aiRateCard.ts`). The customer
 * price is `AI_RATE_CARD.marginMultiplier` (1.5x) times the provider-cost
 * budget credited to the workspace, so the delivered budget is derived from
 * the price, never typed by hand. The smallest pack equals the $10 minimum
 * top-up. Every organization may buy every credit pack.
 */

import type { PricingPlan, PlanTier } from "./planRegistry";
import { AI_RATE_CARD, deliveredBudgetCentsForPrice } from "./aiRateCard";

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

const ALL_SELF_SERVICE_TIERS: ReadonlyArray<PlanTier> = ["starter", "growth", "business"];
const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
function creditPack(sku: string, size: string, priceCents: number): AddOnPackageDef {
  const delivered = deliveredBudgetCentsForPrice(priceCents);
  return {
    sku,
    displayName: `AI credits · ${size}`,
    category: "ai_credits",
    tagline: `Prepay ${fmt(priceCents)} once for ${fmt(delivered)} of provider-cost budget (rate card ${AI_RATE_CARD.version}). Never expires.`,
    priceCents,
    deliveredAICreditsCents: delivered,
    deliveredSeats: 0,
    deliveredConnectors: 0,
    validFor: "permanent",
    allowedTiers: ALL_SELF_SERVICE_TIERS,
  };
}

// $10 -> $6.66, $40 -> $26.66, $150 -> $100.00 of provider-cost budget.
const AI_CREDITS_SMALL = creditPack("ai_credits_small", "small", AI_RATE_CARD.minimumTopUpCents);
const AI_CREDITS_MEDIUM = creditPack("ai_credits_medium", "medium", 4000);
const AI_CREDITS_LARGE = creditPack("ai_credits_large", "large", 15000);

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
