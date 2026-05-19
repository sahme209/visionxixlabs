/**
 * Vitest unit tests for the feature flag catalog.
 *
 * Locks in: every catalog entry has a unique key, the isFeatureFlagKey
 * predicate matches the TS union, defaultFlagValue throws on unknown
 * keys (closed-union safety), and every group label maps to at least
 * one flag (so the dashboard never renders an empty group).
 */

import { describe, it, expect } from "vitest";
import {
  FEATURE_FLAG_CATALOG,
  defaultFlagValue,
  isFeatureFlagKey,
} from "../featureFlagCatalog";

describe("feature flag catalog", () => {
  it("declares at least one flag per group", () => {
    const groups = new Set(FEATURE_FLAG_CATALOG.map((f) => f.group));
    expect(groups.has("autonomy")).toBe(true);
    expect(groups.has("notifications")).toBe(true);
    expect(groups.has("audit")).toBe(true);
    expect(groups.has("ui")).toBe(true);
  });

  it("has unique keys (no catalog dupes)", () => {
    const keys = FEATURE_FLAG_CATALOG.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every entry has a non-empty label + description", () => {
    for (const f of FEATURE_FLAG_CATALOG) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(20);
    }
  });

  it("isFeatureFlagKey narrows valid catalog keys", () => {
    expect(isFeatureFlagKey("autonomy.shadow_mode")).toBe(true);
    expect(isFeatureFlagKey("notifications.weekly_digest")).toBe(true);
    expect(isFeatureFlagKey("ui.contextual_help_bubble")).toBe(true);
  });

  it("isFeatureFlagKey rejects unknown keys", () => {
    expect(isFeatureFlagKey("autonomy.totally_made_up")).toBe(false);
    expect(isFeatureFlagKey("")).toBe(false);
    expect(isFeatureFlagKey("/dashboard/charter")).toBe(false);
  });

  it("defaultFlagValue returns the catalog default for known keys", () => {
    expect(defaultFlagValue("audit.persist_rationale")).toBe(true);
    expect(defaultFlagValue("autonomy.shadow_mode")).toBe(false);
  });

  it("defaultFlagValue throws for unknown keys (closed-union safety)", () => {
    // @ts-expect-error — intentionally invalid for the runtime guard.
    expect(() => defaultFlagValue("not.a.real.key")).toThrow(/Unknown feature flag/);
  });
});
