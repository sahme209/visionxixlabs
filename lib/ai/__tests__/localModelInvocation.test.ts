import { describe, it, expect } from "vitest";
import {
  guardInvocation,
  validateModelOutput,
  type LocalModelInvocation,
  type RegisteredModel,
} from "../localModelInvocation";

const MODEL: RegisteredModel = {
  id: "mdl-coder-7b",
  status: "approved",
  mode: "local",
  modelType: "coding",
  riskLevel: "low",
  supportedAgents: ["specWriter", "testCoverageProposer"],
  maxPromptChars: 2000,
  maxOutputTokens: 512,
};

function inv(overrides: Partial<LocalModelInvocation> = {}): LocalModelInvocation {
  return {
    modelId: MODEL.id,
    callingKernel: "specWriter",
    prompt: "Draft a one-line refactor spec for renaming getCwd to getCurrentWorkingDirectory.",
    maxOutputTokens: 200,
    expectedShape: "free_text",
    reason: "Drafting an engineering spec.",
    ...overrides,
  };
}

describe("guardInvocation", () => {
  it("happy path returns redacted prompt + fingerprint", () => {
    const r = guardInvocation(inv(), MODEL);
    expect(r.ok).toBe(true);
    expect(r.redactedPrompt).toBeDefined();
    expect(r.invocationFingerprint).toMatch(/model=mdl-coder-7b/);
  });

  it("refuses unknown model", () => {
    const r = guardInvocation(inv({ modelId: "ghost" }), undefined);
    expect(r.error).toBe("model_unknown");
  });

  it("refuses non-approved status", () => {
    const r = guardInvocation(inv(), { ...MODEL, status: "evaluating" });
    expect(r.error).toBe("model_not_approved");
  });

  it("refuses calling kernel not in supportedAgents", () => {
    const r = guardInvocation(inv({ callingKernel: "ghost" }), MODEL);
    expect(r.error).toBe("agent_not_supported");
  });

  it("refuses oversized prompt", () => {
    const r = guardInvocation(inv({ prompt: "x".repeat(3000) }), MODEL);
    expect(r.error).toBe("prompt_too_long");
  });

  it("refuses excessive output tokens", () => {
    const r = guardInvocation(inv({ maxOutputTokens: 10_000 }), MODEL);
    expect(r.error).toBe("tokens_too_high");
  });

  it("requires expectedEmbeddingDims when shape is embedding_vector", () => {
    const r = guardInvocation(inv({ expectedShape: "embedding_vector" }), MODEL);
    expect(r.error).toBe("missing_expected_dims");
  });

  it("refuses prompt with email addresses by default", () => {
    const r = guardInvocation(inv({ prompt: "Reach out to sam@example.com about the bug." }), MODEL);
    expect(r.error).toBe("pii_detected");
  });

  it("refuses prompt with AWS access key", () => {
    const r = guardInvocation(inv({ prompt: "Use AKIAABCDEFGHIJKLMNOP as the key." }), MODEL);
    expect(r.error).toBe("pii_detected");
  });

  it("refuses prompt with Stripe secret key", () => {
    const r = guardInvocation(
      inv({ prompt: "Stripe key: sk_live_51T4nMIabcdefghijklmnopqrstuv test" }),
      MODEL,
    );
    expect(r.error).toBe("pii_detected");
  });

  it("allows PII through when allowEmbeddedSecrets is set", () => {
    const r = guardInvocation(
      inv({ prompt: "Reach sam@example.com" }),
      MODEL,
      { allowEmbeddedSecrets: true },
    );
    expect(r.ok).toBe(true);
    expect(r.redactedPrompt).toContain("[REDACTED_EMAIL]");
  });

  it("redacts IPv4 addresses", () => {
    const r = guardInvocation(
      inv({ prompt: "Server 10.0.1.42 is misconfigured." }),
      MODEL,
      { allowEmbeddedSecrets: true },
    );
    expect(r.ok).toBe(true);
    expect(r.redactedPrompt).toContain("[REDACTED_IPV4]");
  });
});

describe("validateModelOutput", () => {
  it("free_text accepts anything non-empty", () => {
    const r = validateModelOutput(inv({ expectedShape: "free_text" }), "any text here");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsed).toBe("any text here");
  });

  it("free_text refuses empty", () => {
    const r = validateModelOutput(inv({ expectedShape: "free_text" }), "   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("empty_output");
  });

  it("json parses + returns parsed value", () => {
    const r = validateModelOutput(inv({ expectedShape: "json" }), '{"x": 1}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsed).toEqual({ x: 1 });
  });

  it("json refuses malformed", () => {
    const r = validateModelOutput(inv({ expectedShape: "json" }), "not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_json");
  });

  it("yaml accepts key: value", () => {
    const r = validateModelOutput(inv({ expectedShape: "yaml" }), "name: test\nstatus: ok");
    expect(r.ok).toBe(true);
  });

  it("single_token accepts short token", () => {
    const r = validateModelOutput(inv({ expectedShape: "single_token" }), "yes");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parsed).toBe("yes");
  });

  it("single_token refuses a sentence", () => {
    const r = validateModelOutput(inv({ expectedShape: "single_token" }), "yes, definitely");
    expect(r.ok).toBe(false);
  });

  it("embedding_vector parses correct length", () => {
    const v = JSON.stringify([0.1, 0.2, 0.3]);
    const r = validateModelOutput(inv({ expectedShape: "embedding_vector", expectedEmbeddingDims: 3 }), v);
    expect(r.ok).toBe(true);
  });

  it("embedding_vector refuses wrong dims", () => {
    const v = JSON.stringify([0.1, 0.2]);
    const r = validateModelOutput(inv({ expectedShape: "embedding_vector", expectedEmbeddingDims: 3 }), v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("wrong_embedding_dims");
  });

  it("embedding_vector refuses non-array", () => {
    const r = validateModelOutput(inv({ expectedShape: "embedding_vector", expectedEmbeddingDims: 3 }), '"not an array"');
    expect(r.ok).toBe(false);
  });
});
