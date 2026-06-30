/**
 * actionRegistry honesty invariants — Phase 653.
 *
 * The Phase 650 registry is the operator's promise:
 *   · what's live actually works
 *   · what's blocked is blocked for a reason
 *   · unsafe actions stay unsafe-blocked
 *
 * These regression tests enforce the promise at build time so the
 * registry can't quietly drift into overclaiming. Adding "live" to
 * an unsafe action, dropping a blocker reason, or duplicating a
 * kind ID fails CI here before it reaches Vercel.
 */

import { describe, it, expect } from "vitest";
import {
  ACTION_REGISTRY,
  computeHonestyCounts,
  CATEGORY_LABEL,
  STATUS_LABEL,
  SAFETY_LABEL,
} from "../actionRegistry";

describe("ACTION_REGISTRY :: shape invariants", () => {
  it("every action has a unique kind", () => {
    const seen = new Set<string>();
    for (const a of ACTION_REGISTRY) {
      expect(seen.has(a.kind), `duplicate kind: ${a.kind}`).toBe(false);
      seen.add(a.kind);
    }
  });

  it("every action has a non-empty label and summary", () => {
    for (const a of ACTION_REGISTRY) {
      expect(a.label.trim().length, `${a.kind} has empty label`).toBeGreaterThan(0);
      expect(a.summary.trim().length, `${a.kind} has empty summary`).toBeGreaterThan(0);
    }
  });

  it("every action's route starts with / or is intentionally non-HTTP", () => {
    for (const a of ACTION_REGISTRY) {
      const ok = a.route.startsWith("/") || a.route.startsWith("(") || a.route.includes("{");
      expect(ok, `${a.kind} route="${a.route}" is malformed`).toBe(true);
    }
  });

  it("every action has a non-empty evidence reference", () => {
    for (const a of ACTION_REGISTRY) {
      expect(a.evidence.trim().length, `${a.kind} has empty evidence`).toBeGreaterThan(0);
    }
  });
});

describe("ACTION_REGISTRY :: honesty invariants", () => {
  it("every blocked action has a blockedReason", () => {
    for (const a of ACTION_REGISTRY) {
      if (a.wireStatus === "blocked") {
        expect(
          a.blockedReason && a.blockedReason.trim().length > 0,
          `${a.kind} is blocked but has no blockedReason`,
        ).toBe(true);
      }
    }
  });

  it("every needs_setup action has a blockedReason explaining the setup", () => {
    for (const a of ACTION_REGISTRY) {
      if (a.wireStatus === "needs_setup") {
        expect(
          a.blockedReason && a.blockedReason.trim().length > 0,
          `${a.kind} needs_setup but has no blockedReason`,
        ).toBe(true);
      }
    }
  });

  it("UNSAFE actions MUST be blocked — never live or preview", () => {
    for (const a of ACTION_REGISTRY) {
      if (a.safetyTier === "unsafe") {
        expect(
          a.wireStatus,
          `${a.kind} is unsafe but wireStatus="${a.wireStatus}" — unsafe must always be blocked by design`,
        ).toBe("blocked");
      }
    }
  });

  it("read_only actions never claim isMutation=true", () => {
    for (const a of ACTION_REGISTRY) {
      if (a.safetyTier === "read_only") {
        expect(a.isMutation, `${a.kind} is read_only but isMutation=true`).toBe(false);
      }
    }
  });

  it("preview-tier actions never claim isMutation=true", () => {
    for (const a of ACTION_REGISTRY) {
      if (a.safetyTier === "preview") {
        expect(a.isMutation, `${a.kind} is preview but isMutation=true`).toBe(false);
      }
    }
  });

  it("integrations that require a connector declare it explicitly", () => {
    // Phase 644-649 integrations always require a connector.
    for (const a of ACTION_REGISTRY) {
      if (a.category === "integrations" && a.kind !== "integration.dispatch_from_memory") {
        expect(
          a.requiresConnector,
          `${a.kind} is an integration but does not declare requiresConnector`,
        ).toBeTruthy();
      }
    }
  });

  it("execution-category actions are all marked unsafe + blocked (no surprise apply path)", () => {
    for (const a of ACTION_REGISTRY) {
      if (a.category === "execution") {
        expect(a.safetyTier, `${a.kind} is execution-category but safetyTier=${a.safetyTier}`).toBe("unsafe");
        expect(a.wireStatus, `${a.kind} is execution-category but wireStatus=${a.wireStatus}`).toBe("blocked");
      }
    }
  });
});

describe("ACTION_REGISTRY :: count math", () => {
  it("status counts sum to total", () => {
    const c = computeHonestyCounts();
    expect(c.live + c.preview + c.needs_setup + c.blocked + c.planned).toBe(c.total);
    expect(c.total).toBe(ACTION_REGISTRY.length);
  });

  it("all unsafe actions are counted as blocked", () => {
    const c = computeHonestyCounts();
    const unsafeCount = ACTION_REGISTRY.filter((a) => a.safetyTier === "unsafe").length;
    // unsafe ⊆ blocked is enforced by another test; assert the
    // counts line up so the Capabilities surface never overclaims.
    expect(c.unsafe).toBeLessThanOrEqual(c.blocked);
    expect(c.unsafe).toBe(unsafeCount);
  });
});

describe("ACTION_REGISTRY :: labels exhaustive", () => {
  it("every category appearing in the registry has a CATEGORY_LABEL", () => {
    const used = new Set(ACTION_REGISTRY.map((a) => a.category));
    for (const c of used) {
      expect(CATEGORY_LABEL[c], `missing CATEGORY_LABEL for ${c}`).toBeTruthy();
    }
  });

  it("every wireStatus appearing has a STATUS_LABEL", () => {
    const used = new Set(ACTION_REGISTRY.map((a) => a.wireStatus));
    for (const s of used) {
      expect(STATUS_LABEL[s], `missing STATUS_LABEL for ${s}`).toBeTruthy();
    }
  });

  it("every safetyTier appearing has a SAFETY_LABEL", () => {
    const used = new Set(ACTION_REGISTRY.map((a) => a.safetyTier));
    for (const t of used) {
      expect(SAFETY_LABEL[t], `missing SAFETY_LABEL for ${t}`).toBeTruthy();
    }
  });
});
