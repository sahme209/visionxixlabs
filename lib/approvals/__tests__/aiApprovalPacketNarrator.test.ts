/**
 * Vitest unit tests for the AI approval-packet narrator fallback.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { narrateApprovalPacket, type ApprovalPacketSeed } from "../aiApprovalPacketNarrator";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const SEED: ApprovalPacketSeed = {
  candidateLabel: "Tighten S3 PAB on axiom-prod-bucket",
  candidateKind: "tighten_s3_pab",
  blastRadius: "single_resource",
  agentSupport: 4,
  agentOppose: 1,
  policyVerdict: "pass",
  boundaryVerdict: "pass",
  evidenceCount: 3,
  estimatedDurationMins: 5,
};

describe("aiApprovalPacketNarrator", () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:1";
    process.env.LM_STUDIO_BASE_URL = "http://127.0.0.1:2";
    _resetAIProviderManagerForTests();
  });

  it("Mock-only fall-through uses the deterministic template", async () => {
    const r = await narrateApprovalPacket(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.paragraph).toContain("tighten_s3_pab");
    expect(r.paragraph).toContain("Tighten S3 PAB on axiom-prod-bucket");
    expect(r.paragraph).toContain("single resource");
    expect(r.paragraph).toContain("4 support");
    expect(r.paragraph).toContain("1 oppose");
  }, 60_000);

  it("fallback flags policy / boundary verdicts", async () => {
    const blocked = await narrateApprovalPacket({ ...SEED, policyVerdict: "fail", boundaryVerdict: "fail" });
    expect(blocked.paragraph).toContain("policy blocked");
    expect(blocked.paragraph).toContain("boundary blocked");
  }, 60_000);

  it("fallback always reaffirms approval-only-no-execution", async () => {
    const r = await narrateApprovalPacket(SEED);
    expect(r.paragraph.toLowerCase()).toContain("approval-only-no-execution");
  }, 60_000);

  it("never throws on empty/zero seed", async () => {
    const r = await narrateApprovalPacket({
      candidateLabel: "", candidateKind: "",
      blastRadius: "org", agentSupport: 0, agentOppose: 0,
      policyVerdict: "unknown", boundaryVerdict: "unknown",
      evidenceCount: 0, estimatedDurationMins: 0,
    });
    expect(typeof r.paragraph).toBe("string");
    expect(r.aiUsed).toBe(false);
  }, 60_000);
});
