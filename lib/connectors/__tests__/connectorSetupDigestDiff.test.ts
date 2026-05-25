import { describe, expect, it } from "vitest";
import { diffOrgDigests } from "../connectorSetupDigestDiff";
import type { OrgDigest, ProviderDigest } from "../connectorSetupDigest";
import type { StickyErrorClassification } from "../connectorSetupStickyError";
import type { ConnectorSetupStatus } from "../connectorSetupSession";

/* ──────────────────────────────────────────────────────────────────
   Phase 421 — pure diff tests.

   We construct synthetic ProviderDigest objects directly — no repo,
   no kernel walks. The diff is pure derivation; everything upstream
   is already covered.
   ────────────────────────────────────────────────────────────── */

const T_PREV = new Date("2026-05-25T10:00:00Z");
const T_CURR = new Date("2026-05-25T11:00:00Z");

function makeProvider(p: {
  provider: string;
  status: ConnectorSetupStatus;
  actionable?: boolean;
  errorClass?: StickyErrorClassification;
}): ProviderDigest {
  return {
    provider: p.provider,
    status: p.status,
    statusLabel: p.status,
    sidebarDotColor: "gray",
    actionable: p.actionable ?? false,
    daysConnected: null,
    minutesSinceTransition: 0,
    suggested: { ctaLabel: "", tone: "none", description: "" },
    errorClass: p.errorClass ?? { kind: "healthy", reason: "no_history" },
    timeline: [],
  };
}

function makeDigest(at: Date, providers: ProviderDigest[]): OrgDigest {
  return {
    organizationId: "o",
    generatedAt: at,
    providers,
    summary: {
      total: providers.length,
      connected: providers.filter((p) => p.status === "connected").length,
      actionable: providers.filter((p) => p.actionable).length,
      inFlight: 0,
      notConnected: providers.filter((p) => p.status === "not_connected").length,
      stickyErrorCount: providers.filter((p) => p.errorClass.kind === "sticky_error").length,
      chronicOscillationCount: providers.filter((p) => p.errorClass.kind === "chronic_oscillation").length,
    },
  };
}

describe("diffOrgDigests — no changes", () => {
  it("identical digests → hasChanges:false, every array empty", () => {
    const prov = makeProvider({ provider: "aws", status: "connected" });
    const prev = makeDigest(T_PREV, [prov]);
    const curr = makeDigest(T_CURR, [prov]);
    const d = diffOrgDigests(prev, curr);
    expect(d.hasChanges).toBe(false);
    expect(d.statusChanged).toEqual([]);
    expect(d.becameActionable).toEqual([]);
    expect(d.becameHealthy).toEqual([]);
    expect(d.stickyEscalated).toEqual([]);
    expect(d.oscillationEscalated).toEqual([]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.windowFromAt).toEqual(T_PREV);
    expect(d.windowToAt).toEqual(T_CURR);
  });
});

describe("diffOrgDigests — status_changed + became_actionable both fire", () => {
  it("connected → failed records BOTH status_changed AND became_actionable", () => {
    const prev = makeDigest(T_PREV, [makeProvider({ provider: "aws", status: "connected", actionable: false })]);
    const curr = makeDigest(T_CURR, [makeProvider({ provider: "aws", status: "failed",    actionable: true })]);
    const d = diffOrgDigests(prev, curr);
    expect(d.statusChanged).toEqual([{ provider: "aws", from: "connected", to: "failed" }]);
    expect(d.becameActionable).toEqual([{ provider: "aws" }]);
    expect(d.becameHealthy).toEqual([]);
    expect(d.hasChanges).toBe(true);
  });

  it("failed → connected records BOTH status_changed AND became_healthy", () => {
    const prev = makeDigest(T_PREV, [makeProvider({ provider: "aws", status: "failed",    actionable: true })]);
    const curr = makeDigest(T_CURR, [makeProvider({ provider: "aws", status: "connected", actionable: false })]);
    const d = diffOrgDigests(prev, curr);
    expect(d.statusChanged).toEqual([{ provider: "aws", from: "failed", to: "connected" }]);
    expect(d.becameHealthy).toEqual([{ provider: "aws" }]);
    expect(d.becameActionable).toEqual([]);
  });
});

describe("diffOrgDigests — sticky / oscillation escalation", () => {
  it("transient → sticky records stickyEscalated", () => {
    const prev = makeDigest(T_PREV, [
      makeProvider({
        provider: "aws", status: "failed", actionable: true,
        errorClass: { kind: "transient_failure", lastFailureAt: T_PREV, errorCode: "AccessDenied" },
      }),
    ]);
    const curr = makeDigest(T_CURR, [
      makeProvider({
        provider: "aws", status: "failed", actionable: true,
        errorClass: { kind: "sticky_error", errorCode: "AccessDenied", consecutiveCount: 3, firstSeenAt: T_PREV, lastSeenAt: T_CURR },
      }),
    ]);
    const d = diffOrgDigests(prev, curr);
    expect(d.stickyEscalated).toEqual([{ provider: "aws" }]);
    // status didn't change → no statusChanged row.
    expect(d.statusChanged).toEqual([]);
  });

  it("already-sticky → sticky does NOT re-fire stickyEscalated", () => {
    const sticky: StickyErrorClassification = { kind: "sticky_error", errorCode: "X", consecutiveCount: 3, firstSeenAt: T_PREV, lastSeenAt: T_CURR };
    const prev = makeDigest(T_PREV, [makeProvider({ provider: "aws", status: "failed", actionable: true, errorClass: sticky })]);
    const curr = makeDigest(T_CURR, [makeProvider({ provider: "aws", status: "failed", actionable: true, errorClass: sticky })]);
    const d = diffOrgDigests(prev, curr);
    expect(d.stickyEscalated).toEqual([]);
    expect(d.hasChanges).toBe(false);
  });

  it("healthy → chronic_oscillation records oscillationEscalated", () => {
    const prev = makeDigest(T_PREV, [makeProvider({ provider: "github", status: "needs_attention", actionable: true })]);
    const curr = makeDigest(T_CURR, [
      makeProvider({
        provider: "github", status: "needs_attention", actionable: true,
        errorClass: { kind: "chronic_oscillation", regressCount: 3, recoverCount: 3, windowFirstAt: T_PREV, windowLastAt: T_CURR },
      }),
    ]);
    const d = diffOrgDigests(prev, curr);
    expect(d.oscillationEscalated).toEqual([{ provider: "github" }]);
  });
});

describe("diffOrgDigests — added / removed providers", () => {
  it("provider only in current → added", () => {
    const prev = makeDigest(T_PREV, []);
    const curr = makeDigest(T_CURR, [makeProvider({ provider: "aws", status: "setup_started" })]);
    const d = diffOrgDigests(prev, curr);
    expect(d.added).toEqual([{ provider: "aws" }]);
    expect(d.removed).toEqual([]);
  });

  it("provider only in previous → removed", () => {
    const prev = makeDigest(T_PREV, [makeProvider({ provider: "aws", status: "connected" })]);
    const curr = makeDigest(T_CURR, []);
    const d = diffOrgDigests(prev, curr);
    expect(d.removed).toEqual([{ provider: "aws" }]);
    expect(d.added).toEqual([]);
  });
});

describe("diffOrgDigests — multi-provider, multi-bucket", () => {
  it("simultaneous becameActionable + becameHealthy + sticky escalation across providers", () => {
    const prev = makeDigest(T_PREV, [
      makeProvider({ provider: "aws",    status: "connected",  actionable: false }),
      makeProvider({ provider: "azure",  status: "failed",     actionable: true }),
      makeProvider({ provider: "gcp",    status: "connected",  actionable: false }),
    ]);
    const curr = makeDigest(T_CURR, [
      makeProvider({
        provider: "aws", status: "failed", actionable: true,
        errorClass: { kind: "sticky_error", errorCode: "AccessDenied", consecutiveCount: 3, firstSeenAt: T_PREV, lastSeenAt: T_CURR },
      }),
      makeProvider({ provider: "azure", status: "connected", actionable: false }),
      makeProvider({ provider: "gcp",   status: "connected", actionable: false }),
    ]);
    const d = diffOrgDigests(prev, curr);
    expect(d.statusChanged.map((s) => s.provider).sort()).toEqual(["aws", "azure"]);
    expect(d.becameActionable.map((p) => p.provider)).toEqual(["aws"]);
    expect(d.becameHealthy.map((p) => p.provider)).toEqual(["azure"]);
    expect(d.stickyEscalated.map((p) => p.provider)).toEqual(["aws"]);
    expect(d.hasChanges).toBe(true);
  });
});
