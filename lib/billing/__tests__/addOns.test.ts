import { describe, it, expect } from "vitest";
import {
  ADD_ON_CATALOG,
  findAddOn,
  findAddOnsForPlan,
  isOfferedAddOn,
} from "../addOnCatalog";
import { AI_RATE_CARD } from "../aiRateCard";
import { applyAddOnsToEntitlements, type AddOnPurchaseRow } from "../applyAddOnsToEntitlements";
import { findPlan } from "../planRegistry";

const STARTER  = findPlan("starter");
const GROWTH   = findPlan("growth");
const BUSINESS = findPlan("business");
const ENTERPRISE = findPlan("enterprise");

describe("ADD_ON_CATALOG — invariants", () => {
  it("every sku is unique", () => {
    const skus = ADD_ON_CATALOG.map((a) => a.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("every ai_credits row credits its full price; the 1.5x margin applies once, at debit", () => {
    expect(AI_RATE_CARD.marginMultiplier).toBe(1.5);
    for (const a of ADD_ON_CATALOG) {
      if (a.category === "ai_credits") {
        expect(a.deliveredAICreditsCents).toBe(a.priceCents);
        expect(a.priceCents).toBeGreaterThanOrEqual(AI_RATE_CARD.minimumTopUpCents);
      }
    }
    expect(findAddOn("ai_credits_small")).toMatchObject({ priceCents: 1000, deliveredAICreditsCents: 1000 });
    expect(findAddOn("ai_credits_medium")).toMatchObject({ priceCents: 4000, deliveredAICreditsCents: 4000 });
    expect(findAddOn("ai_credits_large")).toMatchObject({ priceCents: 15000, deliveredAICreditsCents: 15000 });
  });

  it("every row is permanent: prepaid AI credits never expire", () => {
    for (const a of ADD_ON_CATALOG) {
      if (a.category === "ai_credits") expect(a.validFor).toBe("permanent");
      if (a.category === "seats")      expect(a.validFor).toBe("permanent");
      if (a.category === "connectors") expect(a.validFor).toBe("permanent");
    }
  });

  it("findAddOn returns null for unknown sku", () => {
    expect(findAddOn("does_not_exist")).toBeNull();
    expect(findAddOn("ai_credits_small")?.sku).toBe("ai_credits_small");
  });
});

describe("findAddOnsForPlan — AI credits are the only paid part", () => {
  const credits = ["ai_credits_large", "ai_credits_medium", "ai_credits_small"];
  it.each([["starter", STARTER], ["growth", GROWTH], ["business", BUSINESS], ["enterprise", ENTERPRISE]] as const)("%s is offered every AI credit pack and nothing else", (_tier, plan) => {
    expect(findAddOnsForPlan(plan).map((a) => a.sku).sort()).toEqual(credits);
  });

  it("keeps seat and connector SKUs readable for historical purchases but never offered", () => {
    for (const sku of ["seat_addon", "connector_addon"]) {
      const addOn = findAddOn(sku);
      expect(addOn).not.toBeNull();
      expect(isOfferedAddOn(addOn!)).toBe(false);
    }
  });
});

describe("applyAddOnsToEntitlements", () => {
  const purchase = (overrides: Partial<AddOnPurchaseRow>): AddOnPurchaseRow => ({
    sku: "ai_credits_small",
    status: "paid",
    deliveredAICreditsCents: 0,
    reversedAICreditsCents: 0,
    deliveredSeats: 0,
    deliveredConnectors: 0,
    validFor: "current_month",
    ...overrides,
  });

  it("no purchases → base entitlements unchanged", () => {
    const r = applyAddOnsToEntitlements(STARTER, []);
    expect(r.includedAICreditsCents).toBe(STARTER.entitlements.includedAICreditsCents);
    expect(r.maxUsers).toBe(STARTER.entitlements.maxUsers);
    expect(r.appliedAICreditsCents).toBe(0);
  });

  it("paid AI credit pack adds to the pool", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({ sku: "ai_credits_small", deliveredAICreditsCents: 2500 }),
    ]);
    expect(r.includedAICreditsCents).toBe(STARTER.entitlements.includedAICreditsCents + 2500);
    expect(r.appliedAICreditsCents).toBe(2500);
  });

  it("multiple paid AI packs accumulate", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({ deliveredAICreditsCents: 2500 }),
      purchase({ deliveredAICreditsCents: 10000 }),
      purchase({ deliveredAICreditsCents: 2500 }),
    ]);
    expect(r.appliedAICreditsCents).toBe(15000);
  });

  it("pending purchases do NOT apply", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({ status: "pending", deliveredAICreditsCents: 2500 }),
    ]);
    expect(r.appliedAICreditsCents).toBe(0);
  });

  it("refunded purchases do NOT apply", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({ status: "refunded", deliveredAICreditsCents: 2500 }),
    ]);
    expect(r.appliedAICreditsCents).toBe(0);
  });

  it("partially refunded purchases apply only their unreversed credits", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({
        status: "partially_refunded",
        deliveredAICreditsCents: 2000,
        reversedAICreditsCents: 500,
      }),
    ]);
    expect(r.appliedAICreditsCents).toBe(1500);
  });

  it("paid seat addon increases the cap", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({ sku: "seat_addon", deliveredSeats: 1, validFor: "permanent" }),
      purchase({ sku: "seat_addon", deliveredSeats: 1, validFor: "permanent" }),
    ]);
    expect(r.maxUsers).toBe(STARTER.entitlements.maxUsers! + 2);
    expect(r.appliedSeats).toBe(2);
  });

  it("paid connector addon increases the cap", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({ sku: "connector_addon", deliveredConnectors: 1, validFor: "permanent" }),
    ]);
    expect(r.maxConnectors).toBe(STARTER.entitlements.maxConnectors! + 1);
  });

  it("Enterprise (null caps) stay null even with seat add-ons", () => {
    const r = applyAddOnsToEntitlements(ENTERPRISE, [
      purchase({ sku: "seat_addon", deliveredSeats: 5, validFor: "permanent" }),
    ]);
    expect(r.maxUsers).toBeNull();
    expect(r.maxConnectors).toBeNull();
    expect(r.appliedSeats).toBe(5); // still tracked for reporting
  });

  it("negative deliveredAICredits is treated as 0 (defensive)", () => {
    const r = applyAddOnsToEntitlements(STARTER, [
      purchase({ deliveredAICreditsCents: -1000 }),
    ]);
    expect(r.appliedAICreditsCents).toBe(0);
  });
});
