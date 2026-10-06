/**
 * Vitest unit tests for runWithFallback.
 *
 * Uses fake in-memory providers to verify ordering, retry policy,
 * and attempt tracking — no real network.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { runWithFallback } from "../AIFallbackHandler";
import { AIProviderError, type AIProvider, type AIProviderName, type AITextResponse } from "../AIProvider";
import { clearUsage, readUsageTail, readUsageTailForOrganization } from "../AIUsageLogger";

class FakeProvider implements AIProvider {
  readonly name: AIProviderName;
  readonly defaultModel: string;
  private readonly mode: "ok" | "throw" | "error";
  constructor(name: AIProviderName, mode: "ok" | "throw" | "error" = "ok") {
    this.name = name;
    this.defaultModel = `${name}-default`;
    this.mode = mode;
  }
  isConfigured(): boolean { return true; }
  async generateText(): Promise<AITextResponse> {
    if (this.mode === "error") {
      throw new AIProviderError({ provider: this.name, kind: "rate_limited", message: "fake", latencyMs: 3 });
    }
    if (this.mode === "throw") {
      throw new Error("vanilla error");
    }
    return {
      text: `from ${this.name}`,
      provider: this.name,
      model: this.defaultModel,
      latencyMs: 1,
      finishReason: "stop",
      usage: null,
    };
  }
  async *streamText(): AsyncIterable<never> { /* unused */ }
  summarize = this.generateText.bind(this);
  classify = (async () => ({ label: "x", score: 1, scores: [{ label: "x", score: 1 }], provider: this.name, model: this.defaultModel, latencyMs: 0 })) as AIProvider["classify"];
  extractStructuredData = (async () => ({ data: {}, raw: "{}", provider: this.name, model: this.defaultModel, latencyMs: 0 })) as AIProvider["extractStructuredData"];
  healthCheck = (async () => ({ ok: true, provider: this.name, model: this.defaultModel, latencyMs: 0 })) as AIProvider["healthCheck"];
}

describe("runWithFallback", () => {
  beforeEach(() => { clearUsage(); });

  it("returns the first provider's result when it succeeds", async () => {
    const a = new FakeProvider("github_models", "ok");
    const b = new FakeProvider("groq", "ok");
    const out = await runWithFallback([a, b], (p) => p.generateText("x"), { task: "generate_text" });
    expect(out.provider).toBe("github_models");
    expect(out.attempts.length).toBe(1);
    expect(out.attempts[0].ok).toBe(true);
  });

  it("falls through to the next provider on AIProviderError", async () => {
    const a = new FakeProvider("github_models", "error");
    const b = new FakeProvider("groq", "ok");
    const out = await runWithFallback([a, b], (p) => p.generateText("x"));
    expect(out.provider).toBe("groq");
    expect(out.attempts.map((a) => a.provider)).toEqual(["github_models", "groq"]);
    expect(out.attempts[0].ok).toBe(false);
    expect(out.attempts[0].errorKind).toBe("rate_limited");
    expect(out.attempts[1].ok).toBe(true);
  });

  it("treats vanilla Error as bad_response and continues", async () => {
    const a = new FakeProvider("github_models", "throw");
    const b = new FakeProvider("mock", "ok");
    const out = await runWithFallback([a, b], (p) => p.generateText("x"));
    expect(out.attempts[0].errorKind).toBe("bad_response");
    expect(out.provider).toBe("mock");
  });

  it("throws when every provider fails", async () => {
    const a = new FakeProvider("github_models", "error");
    const b = new FakeProvider("groq", "error");
    await expect(runWithFallback([a, b], (p) => p.generateText("x"))).rejects.toBeInstanceOf(AIProviderError);
  });

  it("throws with kind=not_configured when given an empty chain", async () => {
    await expect(runWithFallback([], (p) => p.generateText("x"))).rejects.toMatchObject({ kind: "not_configured" });
  });

  it("records one usage event per attempt with the right status", async () => {
    const a = new FakeProvider("github_models", "error");
    const b = new FakeProvider("groq", "ok");
    await runWithFallback([a, b], (p) => p.generateText("x"), { task: "generate_text" });
    const tail = readUsageTail(10);
    // Tail is reversed (newest first); we expect groq=ok first, then github=error
    expect(tail.length).toBe(2);
    expect(tail[0]).toMatchObject({ provider: "groq", status: "ok" });
    expect(tail[1]).toMatchObject({ provider: "github_models", status: "error", errorKind: "rate_limited" });
  });

  it("attributes fallback attempts to the requesting workspace", async () => {
    const a = new FakeProvider("github_models", "error");
    const b = new FakeProvider("groq", "ok");
    await runWithFallback([a, b], (p) => p.generateText("x"), {
      task: "generate_text",
      organizationId: "org-a",
    });
    expect(readUsageTailForOrganization("org-a")).toHaveLength(2);
    expect(readUsageTailForOrganization("org-b")).toHaveLength(0);
  });
});
