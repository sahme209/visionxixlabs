import { describe, it, expect, beforeEach } from "vitest";
import {
  draftMarketingPosts,
  __resetDraftCounter,
  type MarketingEvent,
} from "../marketingContentDrafter";

beforeEach(() => __resetDraftCounter());

describe("marketingContentDrafter", () => {
  it("rejects missing summary", () => {
    expect(() => draftMarketingPosts({ kind: "phase_shipped", summary: "" })).toThrow();
    expect(() => draftMarketingPosts({ kind: "phase_shipped", summary: "   " })).toThrow();
  });

  it("rejects empty channel list", () => {
    expect(() =>
      draftMarketingPosts({ kind: "phase_shipped", summary: "ok" }, []),
    ).toThrow();
  });

  it("default channels are linkedin + x", () => {
    const r = draftMarketingPosts({ kind: "phase_shipped", summary: "Phase 301 shipped." });
    expect(r.drafts.map((d) => d.channel).sort()).toEqual(["linkedin", "x"]);
  });

  it("x body is hard-capped at 280 chars", () => {
    const long = "Phase 301 shipped. ".repeat(40);
    const r = draftMarketingPosts({ kind: "phase_shipped", summary: long }, ["x"]);
    expect(r.drafts[0].charCount).toBeLessThanOrEqual(280);
    expect(r.drafts[0].body.endsWith("…")).toBe(true);
  });

  it("linkedin body includes facts + references + closer", () => {
    const r = draftMarketingPosts(
      {
        kind: "phase_shipped",
        summary: "Phase 301 shipped.",
        facts: ["1169 tests passing", "Zero new Prisma models"],
        references: ["839954b"],
      },
      ["linkedin"],
    );
    expect(r.drafts[0].body).toContain("1169 tests passing");
    expect(r.drafts[0].body).toContain("Zero new Prisma models");
    expect(r.drafts[0].body).toContain("Ref: 839954b");
    expect(r.drafts[0].body).toMatch(/Approval-only/i);
  });

  it("customer mention escalates to high tier + dual approval", () => {
    const event: MarketingEvent = {
      kind: "milestone",
      summary: "Onboarded Acme Corp this week.",
      mentionsCustomer: true,
    };
    const r = draftMarketingPosts(event, ["linkedin"]);
    expect(r.drafts[0].riskTier).toBe("high");
    expect(r.drafts[0].recommendedGate).toBe("dual_approval");
  });

  it("incident mention escalates to critical + dual approval", () => {
    const event: MarketingEvent = {
      kind: "incident_resolved",
      summary: "Yesterday's degraded performance is resolved.",
      mentionsIncident: true,
    };
    const r = draftMarketingPosts(event, ["linkedin"]);
    expect(r.drafts[0].riskTier).toBe("critical");
    expect(r.drafts[0].recommendedGate).toBe("dual_approval");
  });

  it("dollar figure bumps tier to medium", () => {
    const r = draftMarketingPosts(
      { kind: "milestone", summary: "Crossed $1M ARR." },
      ["linkedin"],
    );
    expect(r.drafts[0].riskTier).toBe("medium");
    expect(r.drafts[0].recommendedGate).toBe("single_approval");
  });

  it("routine post stays low risk + single approval", () => {
    const r = draftMarketingPosts(
      { kind: "phase_shipped", summary: "Phase 301 shipped." },
      ["linkedin"],
    );
    expect(r.drafts[0].riskTier).toBe("low");
    expect(r.drafts[0].recommendedGate).toBe("single_approval");
  });

  it("hashtag cap differs by channel", () => {
    const r = draftMarketingPosts({ kind: "phase_shipped", summary: "ok" }, ["linkedin", "x"]);
    const li = r.drafts.find((d) => d.channel === "linkedin")!;
    const x  = r.drafts.find((d) => d.channel === "x")!;
    expect(li.hashtags.length).toBeLessThanOrEqual(4);
    expect(x.hashtags.length).toBeLessThanOrEqual(2);
  });

  it("CTA url is channel-agnostic and matches event kind", () => {
    const r = draftMarketingPosts({ kind: "phase_shipped", summary: "ok" }, ["linkedin"]);
    expect(r.drafts[0].cta.href).toMatch(/changelog/);
  });

  it("issues sequential ids", () => {
    const r = draftMarketingPosts({ kind: "phase_shipped", summary: "ok" }, ["linkedin", "x"]);
    expect(r.drafts[0].id).toBe("draft-1");
    expect(r.drafts[1].id).toBe("draft-2");
  });
});
