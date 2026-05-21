import { describe, it, expect } from "vitest";
import { draftPostmortem, PostmortemValidationError, type PostmortemInput, type ActionItem } from "../postmortemDrafter";
import { weaveTimeline, type IncidentEvent } from "../incidentTimelineWeaver";

const RESOLVED_EVENTS: IncidentEvent[] = [
  { id: "1", at: "2026-05-21T10:00:00Z", kind: "alert_fired",          actor: "detector", description: "CPU > 90%" },
  { id: "2", at: "2026-05-21T10:02:00Z", kind: "operator_acknowledged", actor: "ops@x",    description: "ack" },
  { id: "3", at: "2026-05-21T10:05:00Z", kind: "rollback_initiated",   actor: "ops@x",    description: "rollback" },
  { id: "4", at: "2026-05-21T10:11:00Z", kind: "service_recovered",    actor: "verifier", description: "ok" },
];

function postmortem(overrides: Partial<PostmortemInput> = {}): PostmortemInput {
  const timeline = weaveTimeline(RESOLVED_EVENTS);
  const items: ActionItem[] = [
    { id: "AI-1", kind: "prevention",    owner: "alice", statement: "Add CPU saturation autoscaler.",      dueAt: "2026-06-01" },
    { id: "AI-2", kind: "detection",     owner: "bob",   statement: "Lower alert threshold to 80% / 3m.",  dueAt: "2026-05-30" },
    { id: "AI-3", kind: "documentation", owner: "carol", statement: "Update runbook with rollback notes.", dueAt: null },
  ];
  return {
    incidentId: "INC-509",
    title: "API CPU saturation",
    severity: "sev2",
    impact: "API p95 spiked from 200ms to 1.2s for ~11 minutes affecting ~5% of requests.",
    rootCause: "An unindexed query on the new /v2/forecast endpoint scanned the orders table.",
    contributingFactors: ["Missing autoscaler", "Endpoint shipped without load test"],
    timeline,
    actionItems: items,
    authorEmail: "ops@example.com",
    ...overrides,
  };
}

describe("draftPostmortem", () => {
  it("happy path → ready_for_review", () => {
    const r = draftPostmortem(postmortem());
    expect(r.verdict).toBe("ready_for_review");
    expect(r.fields.totalOutageMinutes).toBe(11);
    expect(r.fields.actionItemCount).toBe(3);
    expect(r.fields.actionItemsByKind.prevention).toBe(1);
    expect(r.fields.actionItemsByKind.detection).toBe(1);
    expect(r.fields.actionItemsByKind.documentation).toBe(1);
  });

  it("rejects missing required fields", () => {
    expect(() => draftPostmortem(postmortem({ incidentId: "" }))).toThrow(PostmortemValidationError);
    expect(() => draftPostmortem(postmortem({ title: "" }))).toThrow(PostmortemValidationError);
    expect(() => draftPostmortem(postmortem({ rootCause: "" }))).toThrow(PostmortemValidationError);
    expect(() => draftPostmortem(postmortem({ authorEmail: "" }))).toThrow(PostmortemValidationError);
  });

  it("ongoing timeline → blocked", () => {
    const ongoing = weaveTimeline(RESOLVED_EVENTS.slice(0, 3)); // no recovery
    const r = draftPostmortem(postmortem({ timeline: ongoing }));
    expect(r.verdict).toBe("blocked");
    expect(r.rationale).toMatch(/premature/i);
  });

  it("empty timeline → blocked", () => {
    const empty = weaveTimeline([]);
    const r = draftPostmortem(postmortem({ timeline: empty }));
    expect(r.verdict).toBe("blocked");
  });

  it("no action items → needs_more_data", () => {
    const r = draftPostmortem(postmortem({ actionItems: [] }));
    expect(r.verdict).toBe("needs_more_data");
    expect(r.rationale).toMatch(/action item/i);
  });

  it("prevention action without owner → needs_more_data", () => {
    const r = draftPostmortem(postmortem({
      actionItems: [{ id: "AI-1", kind: "prevention", owner: "", statement: "fix it", dueAt: "2026-06-01" }],
    }));
    expect(r.verdict).toBe("needs_more_data");
    expect(r.fields.hasBreakingActionItems).toBe(true);
  });

  it("prevention action without dueAt → needs_more_data", () => {
    const r = draftPostmortem(postmortem({
      actionItems: [{ id: "AI-1", kind: "prevention", owner: "alice", statement: "fix it", dueAt: null }],
    }));
    expect(r.verdict).toBe("needs_more_data");
    expect(r.fields.hasBreakingActionItems).toBe(true);
  });

  it("markdown body includes key sections", () => {
    const r = draftPostmortem(postmortem());
    expect(r.markdown).toContain("## Impact");
    expect(r.markdown).toContain("## Key durations");
    expect(r.markdown).toContain("## Root cause");
    expect(r.markdown).toContain("## Timeline");
    expect(r.markdown).toContain("## Action items");
    expect(r.markdown).toContain("## Verdict");
  });

  it("markdown shows correct TTD / TTM / TTR / total outage", () => {
    const r = draftPostmortem(postmortem());
    // TTD=2m, TTM=3m, TTR=6m, total=11m
    expect(r.markdown).toContain("2m");
    expect(r.markdown).toContain("3m");
    expect(r.markdown).toContain("6m");
    expect(r.markdown).toContain("11m");
  });

  it("contributing factors render as bullets", () => {
    const r = draftPostmortem(postmortem());
    expect(r.markdown).toContain("Missing autoscaler");
    expect(r.markdown).toContain("Endpoint shipped without load test");
  });

  it("rendered severity uses canonical label", () => {
    const r = draftPostmortem(postmortem({ severity: "sev1" }));
    expect(r.markdown).toMatch(/SEV1.*outage/i);
  });
});
