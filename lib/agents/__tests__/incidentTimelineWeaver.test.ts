import { describe, it, expect } from "vitest";
import {
  weaveTimeline,
  renderTimelineMarkdown,
  type IncidentEvent,
} from "../incidentTimelineWeaver";

const FULL_INCIDENT: IncidentEvent[] = [
  { id: "1", at: "2026-05-21T10:00:00Z", kind: "alert_fired",         actor: "detector",  description: "CPU > 90% on api-prod" },
  { id: "2", at: "2026-05-21T10:02:00Z", kind: "operator_acknowledged", actor: "ops@x",   description: "On it" },
  { id: "3", at: "2026-05-21T10:03:00Z", kind: "bus_message",          actor: "reasoner",  description: "Forming hypothesis" },
  { id: "4", at: "2026-05-21T10:05:00Z", kind: "rollback_initiated",   actor: "ops@x",     description: "Rollback to v1.6.0" },
  { id: "5", at: "2026-05-21T10:11:00Z", kind: "service_recovered",    actor: "verifier",  description: "CPU < 60% sustained" },
  { id: "6", at: "2026-05-21T10:15:00Z", kind: "audit_action",         actor: "auditor",   description: "Recovery audit row written" },
];

describe("weaveTimeline", () => {
  it("empty events → no_signal", () => {
    const t = weaveTimeline([]);
    expect(t.events.length).toBe(0);
    expect(t.finalState).toBe("no_signal");
    expect(t.durations.totalOutageMinutes).toBeNull();
  });

  it("full incident → markers + durations + finalState recovered", () => {
    const t = weaveTimeline(FULL_INCIDENT);
    expect(t.finalState).toBe("recovered");
    expect(t.markers.detectionAt).toBe("2026-05-21T10:00:00Z");
    expect(t.markers.acknowledgedAt).toBe("2026-05-21T10:02:00Z");
    expect(t.markers.mitigationStartedAt).toBe("2026-05-21T10:05:00Z");
    expect(t.markers.recoveredAt).toBe("2026-05-21T10:11:00Z");
    expect(t.durations.ttdMinutes).toBe(2);
    expect(t.durations.ttmMinutes).toBe(3);
    expect(t.durations.ttrMinutes).toBe(6);
    expect(t.durations.totalOutageMinutes).toBe(11);
  });

  it("phase tagging covers all phases", () => {
    const t = weaveTimeline(FULL_INCIDENT);
    const phases = new Set(t.events.map((e) => e.phase));
    expect(phases.has("detection")).toBe(true);
    expect(phases.has("investigation")).toBe(true);
    expect(phases.has("mitigation")).toBe(true);
    expect(phases.has("after_recovery")).toBe(true);
  });

  it("out-of-order input is sorted ascending", () => {
    const shuffled = [...FULL_INCIDENT].reverse();
    const t = weaveTimeline(shuffled);
    for (let i = 1; i < t.events.length; i++) {
      expect(new Date(t.events[i].at).getTime()).toBeGreaterThanOrEqual(new Date(t.events[i - 1].at).getTime());
    }
  });

  it("no recovery yet → ongoing", () => {
    const t = weaveTimeline(FULL_INCIDENT.slice(0, 4));
    expect(t.finalState).toBe("ongoing");
    expect(t.markers.recoveredAt).toBeNull();
    expect(t.durations.ttrMinutes).toBeNull();
  });

  it("hadActionableEvents flips when a rollback / deploy / automation exists", () => {
    const t = weaveTimeline(FULL_INCIDENT);
    expect(t.hadActionableEvents).toBe(true);

    const noAction = weaveTimeline([FULL_INCIDENT[0], FULL_INCIDENT[1]]);
    expect(noAction.hadActionableEvents).toBe(false);
  });

  it("renderTimelineMarkdown groups by phase headings", () => {
    const t = weaveTimeline(FULL_INCIDENT);
    const md = renderTimelineMarkdown(t);
    expect(md).toMatch(/### Detection/);
    expect(md).toMatch(/### Mitigation/);
    expect(md).toMatch(/### After recovery/);
  });

  it("ttd null when no operator ack present", () => {
    const t = weaveTimeline([FULL_INCIDENT[0]]);
    expect(t.durations.ttdMinutes).toBeNull();
  });

  it("operator_action counts as a mitigation event", () => {
    const events: IncidentEvent[] = [
      { id: "1", at: "2026-05-21T10:00:00Z", kind: "alert_fired",          actor: "d",       description: "x" },
      { id: "2", at: "2026-05-21T10:01:00Z", kind: "operator_acknowledged", actor: "ops",     description: "ack" },
      { id: "3", at: "2026-05-21T10:02:00Z", kind: "operator_action",      actor: "ops",     description: "feature flag flipped" },
      { id: "4", at: "2026-05-21T10:05:00Z", kind: "service_recovered",    actor: "verifier", description: "ok" },
    ];
    const t = weaveTimeline(events);
    expect(t.markers.mitigationStartedAt).toBe("2026-05-21T10:02:00Z");
    expect(t.durations.ttrMinutes).toBe(3);
  });
});
