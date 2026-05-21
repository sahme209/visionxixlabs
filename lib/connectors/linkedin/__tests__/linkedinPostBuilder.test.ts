import { describe, it, expect } from "vitest";
import { buildLinkedInPost, type LinkedInAuthor } from "../linkedinPostBuilder";
import type { SocialDraft } from "@/lib/agents/marketingContentDrafter";

function liDraft(partial: Partial<SocialDraft> = {}): SocialDraft {
  return {
    id: "draft-1",
    channel: "linkedin",
    body: "Phase 301 shipped.\n\n• Marketing kernels added\n• 1169 tests still green",
    hashtags: ["AIops", "DevOps"],
    cta: { label: "See what shipped", href: "https://visionxixlabs.com/changelog" },
    riskTier: "low",
    recommendedGate: "single_approval",
    charCount: 0,
    riskReasons: ["Routine"],
    ...partial,
  };
}

const ORG: LinkedInAuthor    = { kind: "organization", urn: "urn:li:organization:12345" };
const PERSON: LinkedInAuthor = { kind: "person",       urn: "urn:li:person:abc-123_DEF" };

describe("buildLinkedInPost", () => {
  it("happy path builds a valid PUBLISHED PUBLIC payload for an org", () => {
    const r = buildLinkedInPost(liDraft(), ORG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.author).toBe(ORG.urn);
      expect(r.payload.lifecycleState).toBe("PUBLISHED");
      expect(r.payload.visibility["com.linkedin.ugc.MemberNetworkVisibility"]).toBe("PUBLIC");
      expect(r.payload.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory).toBe("NONE");
      expect(r.payload.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text).toContain("Phase 301");
      expect(r.previewText).toContain("#AIops");
      expect(r.previewText).toContain("https://visionxixlabs.com/changelog");
      expect(r.requiredScopes).toEqual(["w_organization_social"]);
    }
  });

  it("person author requires w_member_social", () => {
    const r = buildLinkedInPost(liDraft(), PERSON);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.requiredScopes).toEqual(["w_member_social"]);
  });

  it("DRAFT lifecycle is honoured", () => {
    const r = buildLinkedInPost(liDraft(), ORG, { lifecycleState: "DRAFT" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.lifecycleState).toBe("DRAFT");
  });

  it("rejects a non-linkedin draft", () => {
    const r = buildLinkedInPost(liDraft({ channel: "x" }), ORG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("draft_not_linkedin");
  });

  it("rejects an invalid URN", () => {
    const r = buildLinkedInPost(liDraft(), { kind: "organization", urn: "not-a-urn" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_author_urn");
  });

  it("rejects empty body", () => {
    const r = buildLinkedInPost(liDraft({ body: "   ", hashtags: [], cta: { label: "", href: "" } }), ORG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("body_empty");
  });

  it("rejects body longer than 3000 chars after assembly", () => {
    const r = buildLinkedInPost(liDraft({ body: "a".repeat(3001), hashtags: [] }), ORG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("body_too_long");
  });

  it("hashtags get # prefix even when caller omits it", () => {
    const r = buildLinkedInPost(liDraft({ hashtags: ["one", "#two"] }), ORG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.previewText).toContain("#one");
      expect(r.previewText).toContain("#two");
    }
  });

  it("CHARS count matches previewText length", () => {
    const r = buildLinkedInPost(liDraft(), ORG);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.charCount).toBe(r.previewText.length);
  });
});
