import { describe, it, expect } from "vitest";
import {
  ADD_ON_CATALOG,
  findAddOn,
  findAddOnsForPlan,
} from "../addOnCatalog";
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

  it("every ai_credits row has deliveredAICreditsCents > priceCents (operator gets discount vs retail)", () => {
    for (const a of ADD_ON_CATALOG) {
      if (a.category === "ai_credits") {
        expect(a.deliveredAICreditsCents).toBeGreaterThan(a.priceCents);
      }
    }
  });

  it("seats + connectors rows are permanent; ai_credits are current_month", () => {
    for (const a of ADD_ON_CATALOG) {
      if (a.category === "ai_credits") expect(a.validFor).toBe("current_month");
      if (a.category === "seats")      expect(a.validFor).toBe("permanent");
      if (a.category === "connectors") expect(a.validFor).toBe("permanent");
    }
  });

  it("findAddOn returns null for unknown sku", () => {
    expect(findAddOn("does_not_exist")).toBeNull();
    expect(findAddOn("ai_credits_small")?.sku).toBe("ai_credits_small");
  });
});

describe("findAddOnsForPlan", () => {
  it("Starter sees small + medium ai credits + seat + connector (no large)", () => {
    const r = findAddOnsForPlan(STARTER);
    const skus = r.map((a) => a.sku).sort();
    expect(skus).toEqual([
      "ai_credits_medium", "ai_credits_small", "connector_addon", "seat_addon",
    ]);
  });

  it("Growth sees all 5 add-ons (including large)", () => {
    expect(findAddOnsForPlan(GROWTH).length).toBe(5);
  });

  it("Business sees all 5 add-ons", () => {
    expect(findAddOnsForPlan(BUSINESS).length).toBe(5);
  });

  it("Enterprise sees the full catalog (reference pricing for custom contracts)", () => {
    expect(findAddOnsForPlan(ENTERPRISE).length).toBe(ADD_ON_CATALOG.length);
  });
});

describe("applyAddOnsToEntitlements", () => {
  const purchase = (overrides: Partial<AddOnPurchaseRow>): AddOnPurchaseRow => ({
    sku: "ai_credits_small",
    status: "paid",
    deliveredAICreditsCents: 0,
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
