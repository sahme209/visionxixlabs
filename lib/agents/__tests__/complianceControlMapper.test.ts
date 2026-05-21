import { describe, it, expect } from "vitest";
import {
  mapControls,
  SEED_CONTROLS,
  type AuditEvent,
} from "../complianceControlMapper";

const NOW = new Date("2026-05-21T12:00:00.000Z");

function evt(id: string, kind: string, daysAgo = 1, actor = "kernel"): AuditEvent {
  return {
    id,
    at: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    kind,
    description: `${kind} occurred`,
    actor,
  };
}

describe("mapControls", () => {
  it("empty events → all controls report gap", () => {
    const r = mapControls(SEED_CONTROLS, [], 90, NOW);
    expect(r.rows.every((row) => row.status === "gap")).toBe(true);
  });

  it("evidence in window satisfies the control", () => {
    const events: AuditEvent[] = [
      evt("e1", "iam_change", 3),
    ];
    const r = mapControls(SEED_CONTROLS, events, 90, NOW);
    const soc2Cc61 = r.rows.find((row) => row.controlId === "CC 6.1");
    expect(soc2Cc61?.status).toBe("satisfied");
  });

  it("evidence older than the window does NOT count", () => {
    const events: AuditEvent[] = [
      evt("e1", "iam_change", 200), // 200d ago, outside 90d window
    ];
    const r = mapControls(SEED_CONTROLS, events, 90, NOW);
    const soc2Cc61 = r.rows.find((row) => row.controlId === "CC 6.1");
    expect(soc2Cc61?.status).toBe("gap");
  });

  it("blocking gaps surface high/critical controls only", () => {
    const r = mapControls(SEED_CONTROLS, [], 90, NOW);
    // Every seed control without evidence is a gap; only high/critical
    // ones land in blockingGaps.
    for (const blocker of r.blockingGaps) {
      const ctl = SEED_CONTROLS.find((c) => c.id === blocker.controlId && c.framework === blocker.framework);
      expect(ctl?.gapRiskTier === "high" || ctl?.gapRiskTier === "critical").toBe(true);
    }
  });

  it("sampleEvidence holds at most 3 entries, newest first", () => {
    const events: AuditEvent[] = [
      evt("e1", "iam_change", 1),
      evt("e2", "iam_change", 3),
      evt("e3", "iam_change", 7),
      evt("e4", "iam_change", 14),
    ];
    const r = mapControls(SEED_CONTROLS, events, 90, NOW);
    const soc2Cc61 = r.rows.find((row) => row.controlId === "CC 6.1");
    expect(soc2Cc61?.sampleEvidence.length).toBe(3);
    // Newest first: e1, e2, e3
    expect(soc2Cc61?.sampleEvidence[0].id).toBe("e1");
    expect(soc2Cc61?.sampleEvidence[1].id).toBe("e2");
    expect(soc2Cc61?.sampleEvidence[2].id).toBe("e3");
  });

  it("partial when evidenceCount < minEvidenceCount with custom controls", () => {
    const custom = [{
      framework: "soc2" as const,
      id: "CUSTOM",
      title: "Need 5 reviews",
      requirement: "Five quarterly access reviews.",
      evidenceKinds: ["access_review_completed"],
      minEvidenceCount: 5,
      gapRiskTier: "medium" as const,
    }];
    const events = [
      evt("e1", "access_review_completed", 5),
      evt("e2", "access_review_completed", 10),
    ];
    const r = mapControls(custom, events, 90, NOW);
    expect(r.rows[0].status).toBe("partial");
  });

  it("per-framework readiness reports % satisfied", () => {
    const events: AuditEvent[] = [
      evt("e1", "iam_change", 3),
      evt("e2", "alert_fired", 5),
    ];
    const r = mapControls(SEED_CONTROLS, events, 90, NOW);
    const soc2 = r.byFramework.find((f) => f.framework === "soc2");
    expect(soc2?.readinessPct).toBeGreaterThan(0);
    expect(soc2?.readinessPct).toBeLessThanOrEqual(100);
  });

  it("ISO 27001 readiness goes up when access_review event lands", () => {
    const empty = mapControls(SEED_CONTROLS, [], 90, NOW);
    const withEvent = mapControls(SEED_CONTROLS, [evt("e1", "iam_change", 1)], 90, NOW);
    const isoEmpty = empty.byFramework.find((f) => f.framework === "iso27001");
    const isoWith  = withEvent.byFramework.find((f) => f.framework === "iso27001");
    expect((isoWith?.readinessPct ?? 0)).toBeGreaterThan(isoEmpty?.readinessPct ?? 0);
  });

  it("GDPR Art. 33 (breach notification) is gap-critical", () => {
    const r = mapControls(SEED_CONTROLS, [], 90, NOW);
    const art33 = r.rows.find((row) => row.controlId === "Art. 33");
    expect(art33?.status).toBe("gap");
    expect(r.blockingGaps.some((b) => b.controlId === "Art. 33")).toBe(true);
  });

  it("controls with multiple acceptable kinds are satisfied by any one of them", () => {
    // CC 6.1 accepts iam_change OR access_review_completed OR
    // user_provisioned OR user_deprovisioned.
    const r = mapControls(SEED_CONTROLS, [evt("e1", "user_provisioned", 5)], 90, NOW);
    const soc2Cc61 = r.rows.find((row) => row.controlId === "CC 6.1");
    expect(soc2Cc61?.status).toBe("satisfied");
  });

  it("recommendedAction is set on gap + partial, null on satisfied", () => {
    const r = mapControls(SEED_CONTROLS, [evt("e1", "iam_change", 1)], 90, NOW);
    const satisfied = r.rows.find((row) => row.status === "satisfied");
    const gap = r.rows.find((row) => row.status === "gap");
    expect(satisfied?.recommendedAction).toBeNull();
    expect(gap?.recommendedAction).not.toBeNull();
  });
});
