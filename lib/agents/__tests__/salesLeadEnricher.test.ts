import { describe, it, expect } from "vitest";
import { enrichLead, type RawLead } from "../salesLeadEnricher";

function lead(overrides: Partial<RawLead> & { id: string; email: string }): RawLead {
  return { ...overrides };
}

describe("salesLeadEnricher", () => {
  it("rejects missing id / invalid email", () => {
    expect(() => enrichLead(lead({ id: "", email: "x@y.z" }))).toThrow();
    expect(() => enrichLead(lead({ id: "a", email: "not-an-email" }))).toThrow();
  });

  it("enterprise hint in message → enterprise segment + enterprise plan", () => {
    const r = enrichLead(lead({
      id: "1", email: "vp@acme-corp.com", role: "VP Engineering",
      message: "We need SOC 2 + self-host options",
    }));
    expect(r.segment).toBe("enterprise");
    expect(r.suggestedPlan).toBe("enterprise");
    expect(r.recommendedAction).toBe("route_to_AE");
  });

  it("mid-market hint → mid_market + scale plan", () => {
    const r = enrichLead(lead({
      id: "1", email: "alice@growthco.io", role: "Director of Engineering",
      message: "We're a fast-growing scale-up looking at multi-cloud ops",
    }));
    expect(r.segment).toBe("mid_market");
    expect(r.suggestedPlan).toBe("scale");
    expect(r.roleSeniority).toBe("director");
  });

  it("Series A hint → startup_growth + growth plan + route_to_AE for exec", () => {
    const r = enrichLead(lead({
      id: "1", email: "bob@startup.dev", role: "CTO",
      message: "Series A startup looking for AI ops",
    }));
    expect(r.segment).toBe("startup_growth");
    expect(r.suggestedPlan).toBe("growth");
    expect(r.recommendedAction).toBe("route_to_AE");
  });

  it("Series A + IC seniority → route_to_AM (not AE)", () => {
    const r = enrichLead(lead({
      id: "1", email: "ic@startup.dev", role: "Software Engineer",
      message: "Series A startup",
    }));
    expect(r.recommendedAction).toBe("route_to_AM");
  });

  it("seed-stage hint → startup_seed + starter plan", () => {
    const r = enrichLead(lead({
      id: "1", email: "founder@startup.dev", role: "Founder",
      message: "Pre-seed, launching in Q3",
    }));
    expect(r.segment).toBe("startup_seed");
    expect(r.suggestedPlan).toBe("starter");
  });

  it("personal email domain → personal segment + trial", () => {
    const r = enrichLead(lead({ id: "1", email: "user@gmail.com" }));
    expect(r.segment).toBe("personal");
    expect(r.suggestedPlan).toBe("trial");
  });

  it("education TLD → education segment", () => {
    const r = enrichLead(lead({ id: "1", email: "prof@university.edu" }));
    expect(r.segment).toBe("education");
  });

  it("ICP fit score is bounded 0..100", () => {
    const r = enrichLead(lead({ id: "1", email: "user@gmail.com", role: "intern" }));
    expect(r.icpFitScore).toBeGreaterThanOrEqual(0);
    expect(r.icpFitScore).toBeLessThanOrEqual(100);
  });

  it("intern seniority → low priority routing", () => {
    const r = enrichLead(lead({
      id: "1", email: "intern@randomcorp.com", role: "intern",
    }));
    expect(r.recommendedAction).toBe("mark_low_priority");
  });

  it("demo-request source → schedule_demo regardless of segment", () => {
    const r = enrichLead(lead({
      id: "1", email: "anyone@gmail.com", source: "demo-request",
    }));
    expect(r.recommendedAction).toBe("schedule_demo");
  });

  it("trial-signup source → send_welcome_email", () => {
    const r = enrichLead(lead({
      id: "1", email: "anyone@gmail.com", source: "trial-signup",
    }));
    expect(r.recommendedAction).toBe("send_welcome_email");
  });

  it("totally unknown lead → needs_human_triage", () => {
    const r = enrichLead(lead({ id: "1", email: "x@randomcorp.io" })); // no role, no message, no company
    expect(r.segment).toBe("unknown");
    expect(r.recommendedAction).toBe("needs_human_triage");
  });

  it("talking points include channel-relevant content", () => {
    const r = enrichLead(lead({
      id: "1", email: "vp@biggie.com", role: "VP Engineering",
      message: "SOC 2 + audit log streaming",
    }));
    const joined = r.talkingPoints.join(" ");
    expect(joined).toMatch(/SOC 2/i);
  });

  it("message presence adds a 'reference the message' talking point", () => {
    const r = enrichLead(lead({
      id: "1", email: "user@gmail.com", message: "Hello, I have a question.",
    }));
    expect(r.talkingPoints.some((t) => /reference it/i.test(t))).toBe(true);
  });

  it("rationale is operator-readable", () => {
    const r = enrichLead(lead({ id: "1", email: "user@gmail.com" }));
    expect(r.rationale).toMatch(/Segment/i);
    expect(r.rationale).toMatch(/Suggested plan/i);
  });
});
