import { describe, expect, it } from "vitest";
import { buildReleaseRiskRadar, summarizeRadar } from "../releaseRiskRadar";
import type { ReleaseContextSummary } from "../../tauri/deploymentRequestSummary";

const base: ReleaseContextSummary = {
  window: { startUtc: "2026-12-01T10:00:00Z", endUtc: "2026-12-01T12:00:00Z", displayTimeZone: "UTC" },
  scope: { applicationCount: 1, repositoryCount: 1, targetEnvironment: "staging" },
  approval: { prStatus: "approved", noPrRequired: false },
  readiness: { developmentReady: true, productionReady: true, validationStepCount: 3, deferredValidation: false, approvalDecision: "ready_for_human_approval", blockers: [] },
  recovery: { rollbackAvailability: "yes", backupRequired: false, evidenceCount: 0 },
  observation: { status: "not_connected", recordedMonitoringPlan: true },
};
const now = new Date("2026-11-26T00:00:00Z");
const level = (ctx: ReleaseContextSummary, id: string) => buildReleaseRiskRadar(ctx, now).find((a) => a.id === id)!;

describe("release risk radar", () => {
  it("covers a well-prepared release but never claims live observation", () => {
    const axes = buildReleaseRiskRadar(base, now);
    expect(axes.map((a) => a.id)).toEqual(["scope", "review", "readiness", "validation", "recovery", "observation", "window"]);
    expect(summarizeRadar(axes)).toEqual({ covered: 6, attention: 1, gap: 0, unknown: 0 });
    expect(level(base, "observation").detail).toContain("not connected");
  });
  it("flags production without rollback as a gap and a missing window as attention", () => {
    const ctx = { ...base, window: null, scope: { ...base.scope, targetEnvironment: "production" }, recovery: { ...base.recovery, rollbackAvailability: "no" } };
    expect(level(ctx, "recovery").level).toBe("gap");
    expect(level(ctx, "window").level).toBe("attention");
  });
  it("keeps unrecorded facts unknown rather than guessing", () => {
    const ctx = { ...base, approval: { prStatus: "unknown_state", noPrRequired: false }, recovery: { ...base.recovery, rollbackAvailability: "" } };
    expect(level(ctx, "review").level).toBe("unknown");
    expect(level(ctx, "recovery").coverage).toBe(0);
  });
  it("marks pending review, blockers, deferred validation and an ended window", () => {
    const ctx = { ...base, approval: { prStatus: "pending", noPrRequired: false },
      readiness: { ...base.readiness, approvalDecision: "needs_attention" as const, blockers: ["a", "b", "c"], deferredValidation: true, validationStepCount: 0 },
      window: { startUtc: "2026-11-01T00:00:00Z", endUtc: "2026-11-02T00:00:00Z", displayTimeZone: "UTC" } };
    expect(level(ctx, "review").level).toBe("attention");
    expect(level(ctx, "readiness")).toMatchObject({ level: "gap", detail: "3 blockers recorded" });
    expect(level(ctx, "validation")).toMatchObject({ level: "attention", detail: "Validation deferred" });
    expect(level(ctx, "window").level).toBe("gap");
  });
  it("treats a wide production scope as attention", () => {
    expect(level({ ...base, scope: { applicationCount: 2, repositoryCount: 2, targetEnvironment: "Production" } }, "scope").level).toBe("attention");
  });
});
