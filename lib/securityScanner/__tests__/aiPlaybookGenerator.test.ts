/**
 * Vitest unit tests for the AI security playbook generator fallback.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { generateSecurityPlaybook, type PlaybookFindingSeed } from "../aiPlaybookGenerator";
import { _resetAIProviderManagerForTests } from "@/lib/ai/AIProviderManager";

const SEED: PlaybookFindingSeed = {
  controlId: "s3-pab",
  severity: "high",
  resourceLabel: "axiom-prod-public-bucket",
  evidenceSnippet: "Bucket grants READ to AllUsers.",
};

describe("aiPlaybookGenerator", () => {
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

  it("Mock-only fall-through returns 5 deterministic steps", async () => {
    const r = await generateSecurityPlaybook(SEED);
    expect(r.aiUsed).toBe(false);
    expect(r.steps.length).toBe(5);
  }, 60_000);

  it("steps preserve order and use only allowed types", async () => {
    const r = await generateSecurityPlaybook(SEED);
    const allowed = ["contain", "investigate", "remediate_propose", "notify", "evidence_capture", "verify"];
    for (let i = 0; i < r.steps.length; i++) {
      expect(r.steps[i].order).toBe(i + 1);
      expect(allowed).toContain(r.steps[i].type);
    }
  }, 60_000);

  it("steps mention the resource label", async () => {
    const r = await generateSecurityPlaybook(SEED);
    const text = r.steps.map((s) => s.action).join(" ");
    expect(text).toContain("axiom-prod-public-bucket");
  }, 60_000);

  it("includes a remediate_propose + verify step in the fallback", async () => {
    const r = await generateSecurityPlaybook(SEED);
    expect(r.steps.find((s) => s.type === "remediate_propose")).toBeDefined();
    expect(r.steps.find((s) => s.type === "verify")).toBeDefined();
  }, 60_000);

  it("never claims auto-execution in the fallback", async () => {
    const r = await generateSecurityPlaybook(SEED);
    const text = r.steps.map((s) => s.action + " " + s.rationale).join(" ").toLowerCase();
    expect(text).not.toContain("auto-apply");
    expect(text).not.toContain("auto execute");
  }, 60_000);
});
