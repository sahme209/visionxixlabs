/**
 * Vitest unit tests for the pure helpdesk triage engine.
 */

import { describe, it, expect } from "vitest";
import { triageTickets, type RawTicket } from "../ticketTriageEngine";

const NOW = "2026-05-20T12:00:00Z";

const T = (id: string, subject: string, body: string, openedHoursAgo: number, tags: string[] = []): RawTicket => {
  const opened = new Date(new Date(NOW).getTime() - openedHoursAgo * 60 * 60 * 1000).toISOString();
  return { id, subject, body, tags, openedAtIso: opened, lastResponseAtIso: null };
};

describe("ticketTriageEngine", () => {
  it("p1 keywords → p1 priority", () => {
    const r = triageTickets({
      tickets: [T("a", "Site outage", "everything is down", 0.5)],
      nowIso: NOW,
    });
    expect(r.triaged[0].priority).toBe("p1");
  });

  it("p2 keywords → p2", () => {
    const r = triageTickets({
      tickets: [T("a", "Asap please", "something broken", 0.5)],
      nowIso: NOW,
    });
    expect(r.triaged[0].priority).toBe("p2");
  });

  it("question keywords → p4", () => {
    const r = triageTickets({
      tickets: [T("a", "Question about feature", "how do I do x", 0.5)],
      nowIso: NOW,
    });
    expect(r.triaged[0].priority).toBe("p4");
  });

  it("default p3 when no keyword matches", () => {
    const r = triageTickets({
      tickets: [T("a", "Note", "blah blah", 0.5)],
      nowIso: NOW,
    });
    expect(r.triaged[0].priority).toBe("p3");
  });

  it("queue infra for AWS-style tickets", () => {
    const r = triageTickets({
      tickets: [T("a", "EC2 weirdness", "aws us-east-1 having issues", 0.5)],
      nowIso: NOW,
    });
    expect(r.triaged[0].queue).toBe("infra");
  });

  it("queue billing for invoice tickets", () => {
    const r = triageTickets({
      tickets: [T("a", "Invoice question", "stripe charge mismatch", 0.5)],
      nowIso: NOW,
    });
    expect(r.triaged[0].queue).toBe("billing");
  });

  it("SLA breached when ageHours > slaHours", () => {
    // p1 default = 1h SLA. 2h old → breached.
    const r = triageTickets({
      tickets: [T("a", "Site outage", "down", 2)],
      nowIso: NOW,
    });
    expect(r.sla[0].status).toBe("breached");
    expect(r.breachedCount).toBe(1);
  });

  it("approaching_sla at >=80% of SLA", () => {
    // p3 default = 24h SLA. 20h old → 83% → approaching.
    const r = triageTickets({
      tickets: [T("a", "Note", "blah", 20)],
      nowIso: NOW,
    });
    expect(r.sla[0].status).toBe("approaching_sla");
    expect(r.approachingCount).toBe(1);
  });

  it("custom slaHours overrides defaults", () => {
    const r = triageTickets({
      tickets: [T("a", "Site outage", "down", 0.5)],
      options: { slaHours: { p1: 0.1 } }, // 6-minute SLA
      nowIso: NOW,
    });
    expect(r.sla[0].status).toBe("breached");
  });

  it("closed ticket → status=closed and excluded from breach count", () => {
    const r = triageTickets({
      tickets: [{
        id: "a", subject: "Site outage", body: "down", tags: [],
        openedAtIso: new Date(new Date(NOW).getTime() - 5 * 60 * 60 * 1000).toISOString(),
        lastResponseAtIso: null,
        closedAtIso: new Date(new Date(NOW).getTime() - 3 * 60 * 60 * 1000).toISOString(),
      }],
      nowIso: NOW,
    });
    expect(r.sla[0].status).toBe("closed");
    expect(r.breachedCount).toBe(0);
  });

  it("sla rows sorted breached → approaching → within → closed", () => {
    const r = triageTickets({
      tickets: [
        T("ok",       "Note",          "blah",    1),    // within
        T("breached", "Site outage",   "down",    5),    // p1 breached
        T("approach", "Question",      "how to",  60),   // p4 approaching (sla=72h, 60/72=83%)
      ],
      nowIso: NOW,
    });
    expect(r.sla[0].ticketId).toBe("breached");
    expect(r.sla[1].ticketId).toBe("approach");
    expect(r.sla[2].ticketId).toBe("ok");
  });
});
