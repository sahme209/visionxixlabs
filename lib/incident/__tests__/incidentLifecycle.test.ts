import { describe, expect, it } from "vitest";
import {
  canTransition,
  isIncidentSeverity,
  isIncidentStatus,
  planIncidentTransition,
  validTransitionsFrom,
  type IncidentStatus,
} from "../incidentLifecycle";

const ALL_STATUSES: IncidentStatus[] = ["detected", "investigating", "mitigated", "resolved", "postmortem_complete"];

describe("incidentLifecycle — type guards", () => {
  it("accepts only the five real statuses", () => {
    for (const s of ALL_STATUSES) expect(isIncidentStatus(s)).toBe(true);
    expect(isIncidentStatus("closed")).toBe(false);
    expect(isIncidentStatus(undefined)).toBe(false);
  });

  it("accepts only the four real severities", () => {
    expect(isIncidentSeverity("critical")).toBe(true);
    expect(isIncidentSeverity("sev1")).toBe(false);
  });
});

describe("incidentLifecycle — forward progression requires every stage", () => {
  it("detected can only move to investigating — never skips ahead", () => {
    expect(canTransition("detected", "investigating")).toBe(true);
    expect(canTransition("detected", "mitigated")).toBe(false);
    expect(canTransition("detected", "resolved")).toBe(false);
    expect(canTransition("detected", "postmortem_complete")).toBe(false);
  });

  it("investigating can only move to mitigated — resolution can't skip mitigation", () => {
    expect(canTransition("investigating", "mitigated")).toBe(true);
    expect(canTransition("investigating", "resolved")).toBe(false);
    expect(canTransition("investigating", "postmortem_complete")).toBe(false);
  });

  it("postmortem_complete is terminal — no transition out of it, in either direction", () => {
    expect(validTransitionsFrom("postmortem_complete")).toEqual([]);
    for (const target of ALL_STATUSES) {
      if (target === "postmortem_complete") continue;
      expect(canTransition("postmortem_complete", target)).toBe(false);
    }
  });
});

describe("incidentLifecycle — reopen paths clear downstream timestamps", () => {
  it("mitigated -> investigating clears mitigatedAt (regression before resolution)", () => {
    const result = planIncidentTransition({ currentStatus: "mitigated", targetStatus: "investigating", now: new Date("2026-01-01") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.status).toBe("investigating");
      expect(result.patch.mitigatedAt).toBeNull();
    }
  });

  it("resolved -> investigating clears resolvedAt and postmortemCompletedAt (regression after resolution)", () => {
    const result = planIncidentTransition({ currentStatus: "resolved", targetStatus: "investigating", now: new Date("2026-01-01") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.resolvedAt).toBeNull();
      expect(result.patch.postmortemCompletedAt).toBeNull();
    }
  });

  it("resolved cannot reopen directly to detected — that would erase the investigation trail", () => {
    expect(canTransition("resolved", "detected")).toBe(false);
  });
});

describe("incidentLifecycle — planIncidentTransition sets the right timestamp per stage", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");

  it("mitigated sets mitigatedAt", () => {
    const result = planIncidentTransition({ currentStatus: "investigating", targetStatus: "mitigated", now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch.mitigatedAt).toBe(now);
  });

  it("resolved sets resolvedAt", () => {
    const result = planIncidentTransition({ currentStatus: "mitigated", targetStatus: "resolved", now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch.resolvedAt).toBe(now);
  });

  it("postmortem_complete sets postmortemCompletedAt", () => {
    const result = planIncidentTransition({ currentStatus: "resolved", targetStatus: "postmortem_complete", now });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch.postmortemCompletedAt).toBe(now);
  });

  it("rejects an invalid transition with a named reason, never a silent no-op success", () => {
    const result = planIncidentTransition({ currentStatus: "detected", targetStatus: "resolved", now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_transition");
  });

  it("rejects any transition attempt out of the terminal postmortem_complete state", () => {
    const result = planIncidentTransition({ currentStatus: "postmortem_complete", targetStatus: "investigating", now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_terminal");
  });
});
