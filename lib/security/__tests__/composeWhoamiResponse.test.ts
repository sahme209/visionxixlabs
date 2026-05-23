import { describe, it, expect } from "vitest";
import { composeWhoamiResponse } from "../composeWhoamiResponse";
import type { QuotaDecision } from "../computeApiQuota";

const QUOTA_ALLOWED: QuotaDecision = {
  kind: "allowed",
  allowed: true,
  monthlyLimit: 10_000,
  currentCalls: 42,
  remaining: 9_958,
  ratio: 0.0042,
  message: "ok",
};

const QUOTA_UNLIMITED: QuotaDecision = {
  kind: "allowed",
  allowed: true,
  monthlyLimit: null,
  currentCalls: 1_000_000,
  remaining: null,
  ratio: null,
  message: "Unlimited quota tier.",
};

const QUOTA_NEAR_LIMIT: QuotaDecision = {
  kind: "allowed_warning_at_threshold",
  allowed: true,
  monthlyLimit: 100,
  currentCalls: 91,
  remaining: 9,
  ratio: 0.91,
  message: "near limit",
};

describe("composeWhoamiResponse — shape", () => {
  it("emits the canonical fields", () => {
    const r = composeWhoamiResponse({
      apiKeyId: "key_abc",
      env: "live",
      scopes: ["release_gate:read", "pipeline:trigger"],
      organizationId: "ws_acme",
      planTier: "growth",
      quota: QUOTA_ALLOWED,
      serverTimeSec: 1_700_000_000,
    });
    expect(r.ok).toBe(true);
    expect(r.apiKey.id).toBe("key_abc");
    expect(r.apiKey.env).toBe("live");
    expect(r.apiKey.scopes).toEqual(["release_gate:read", "pipeline:trigger"]);
    expect(r.organization.id).toBe("ws_acme");
    expect(r.organization.planTier).toBe("growth");
    expect(r.serverTimeSec).toBe(1_700_000_000);
  });
});

describe("composeWhoamiResponse — quota math", () => {
  it("increments currentCalls by 1 to reflect this in-flight call", () => {
    const r = composeWhoamiResponse({
      apiKeyId: "k", env: "live", scopes: [], organizationId: "o",
      planTier: "starter", quota: QUOTA_ALLOWED,
    });
    expect(r.quota.currentCalls).toBe(43);
    expect(r.quota.remaining).toBe(9_957);
  });

  it("nearLimit flag flips at 90%", () => {
    const r = composeWhoamiResponse({
      apiKeyId: "k", env: "live", scopes: [], organizationId: "o",
      planTier: "starter", quota: QUOTA_NEAR_LIMIT,
    });
    expect(r.quota.nearLimit).toBe(true);
  });

  it("nearLimit is false below 90%", () => {
    const r = composeWhoamiResponse({
      apiKeyId: "k", env: "live", scopes: [], organizationId: "o",
      planTier: "starter", quota: QUOTA_ALLOWED,
    });
    expect(r.quota.nearLimit).toBe(false);
  });

  it("unlimited tier keeps remaining=null", () => {
    const r = composeWhoamiResponse({
      apiKeyId: "k", env: "live", scopes: [], organizationId: "o",
      planTier: "enterprise", quota: QUOTA_UNLIMITED,
    });
    expect(r.quota.monthlyLimit).toBeNull();
    expect(r.quota.remaining).toBeNull();
    expect(r.quota.ratio).toBeNull();
    expect(r.quota.nearLimit).toBe(false);
  });

  it("remaining never goes negative", () => {
    const quota: QuotaDecision = {
      kind: "allowed_warning_at_threshold",
      allowed: true,
      monthlyLimit: 10,
      currentCalls: 10,    // would be remaining=0 → -1
      remaining: 0,
      ratio: 1.0,
      message: "ok",
    };
    const r = composeWhoamiResponse({
      apiKeyId: "k", env: "live", scopes: [], organizationId: "o",
      planTier: "starter", quota,
    });
    expect(r.quota.remaining).toBe(0);
  });
});

describe("composeWhoamiResponse — serverTimeSec default", () => {
  it("defaults to current epoch seconds when not provided", () => {
    const before = Math.floor(Date.now() / 1000);
    const r = composeWhoamiResponse({
      apiKeyId: "k", env: "live", scopes: [], organizationId: "o",
      planTier: "starter", quota: QUOTA_ALLOWED,
    });
    const after = Math.floor(Date.now() / 1000);
    expect(r.serverTimeSec).toBeGreaterThanOrEqual(before);
    expect(r.serverTimeSec).toBeLessThanOrEqual(after);
  });
});
