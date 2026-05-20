/**
 * Vitest unit tests for the billing tier catalog.
 *
 * Locks in: closed-union validation, additive feature gating
 * (higher tiers inherit lower-tier features), unknown features
 * default to allowed, defaultFlagValue-style throw on unknown tier.
 */

import { describe, it, expect } from "vitest";
import { isBillingTier, tierAllows, tierSpec, TIER_CATALOG } from "../tierCatalog";

describe("billing tier catalog", () => {
  it("declares all 4 expected tiers", () => {
    const keys = TIER_CATALOG.map((t) => t.tier).sort();
    expect(keys).toEqual(["enterprise", "growth", "starter", "trial"]);
  });

  it("isBillingTier narrows known tiers", () => {
    expect(isBillingTier("trial")).toBe(true);
    expect(isBillingTier("starter")).toBe(true);
    expect(isBillingTier("growth")).toBe(true);
    expect(isBillingTier("enterprise")).toBe(true);
  });

  it("isBillingTier rejects unknown tiers", () => {
    expect(isBillingTier("free")).toBe(false);
    expect(isBillingTier("premium")).toBe(false);
    expect(isBillingTier("")).toBe(false);
  });

  it("tierSpec returns label + caps for known tiers", () => {
    const spec = tierSpec("starter");
    expect(spec.label).toBe("Starter");
    expect(typeof spec.caps.autonomyCyclesPerDay).toBe("number");
  });

  it("tierSpec throws on unknown tier (closed-union safety)", () => {
    // @ts-expect-error — intentional runtime guard test.
    expect(() => tierSpec("nope")).toThrow(/Unknown billing tier/);
  });

  it("tierAllows is additive — growth inherits starter features", () => {
    // Starter exposes "runbooks".
    expect(tierAllows("starter", "runbooks")).toBe(true);
    expect(tierAllows("growth", "runbooks")).toBe(true);
    expect(tierAllows("enterprise", "runbooks")).toBe(true);
    // Trial does NOT have "runbooks".
    expect(tierAllows("trial", "runbooks")).toBe(false);
  });

  it("tierAllows gates higher-tier-only features", () => {
    // "policy-previews" is growth+. Starter must not have it.
    expect(tierAllows("starter", "policy-previews")).toBe(false);
    expect(tierAllows("growth", "policy-previews")).toBe(true);
    expect(tierAllows("enterprise", "policy-previews")).toBe(true);

    // "admin-cross-tenant" is enterprise-only.
    expect(tierAllows("starter", "admin-cross-tenant")).toBe(false);
    expect(tierAllows("growth", "admin-cross-tenant")).toBe(false);
    expect(tierAllows("enterprise", "admin-cross-tenant")).toBe(true);
  });

  it("tierAllows defaults UNKNOWN feature keys to allowed", () => {
    expect(tierAllows("trial", "totally-new-feature-we-have-not-cataloged")).toBe(true);
    expect(tierAllows("starter", "experimental-magic")).toBe(true);
  });

  it("every catalog entry has non-empty label + description + caps", () => {
    for (const t of TIER_CATALOG) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(10);
      expect(typeof t.caps.autonomyCyclesPerDay).toBe("number");
      expect(typeof t.caps.stagedRunbooks).toBe("number");
      expect(typeof t.caps.outboundPerDay).toBe("number");
      expect(typeof t.caps.cloudConnectors).toBe("number");
    }
  });
});
