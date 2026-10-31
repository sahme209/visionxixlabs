import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ create: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { aIInvocation: { create: m.create } } }));
vi.mock("@/lib/ai/AIProviderManager", () => ({ getAIProviderManager: () => ({
  status: () => [{ provider: "vercel_gateway", configured: true, defaultModel: "fixture/model" }],
  generateText: m.generate,
}) }));

import { logAIInvocation } from "../instrumentation";
import { generate } from "../orchestrator";

const fixtureToken = "ghp_" + "a".repeat(36);
const base = { taskType: "CHAT_FAST", provider: "vercel_gateway", model: "fixture/model", success: true };

describe("AI invocation credential-redaction boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    m.create.mockResolvedValue({});
    m.generate.mockResolvedValue({ text: "Answer", model: "fixture/model", usage: { promptTokens: 1, completionTokens: 1 } });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("redacts complete credentials before the storage preview limit and error write", async () => {
    await logAIInvocation({ ...base, promptPreview: "x".repeat(190) + " " + fixtureToken, errorMessage: "Provider rejected " + fixtureToken });
    const data = m.create.mock.calls[0][0].data;
    expect(data.promptPreview).not.toContain("ghp_");
    expect(data.errorMessage).toBe("Provider rejected [REDACTED-GITHUB-PAT]");
    expect(data.promptPreview.length).toBeLessThanOrEqual(201);
    expect(JSON.stringify(data)).not.toContain(fixtureToken);
  });

  it("actual orchestrator redacts before its shorter system and user slices", async () => {
    await generate({ taskType: "CHAT_FAST", systemPrompt: "s".repeat(90) + " " + fixtureToken, userPrompt: "u".repeat(70) + " " + fixtureToken });
    const data = m.create.mock.calls[0][0].data;
    expect(data.promptPreview).toContain("[REDACT");
    expect(data.promptPreview).not.toContain("ghp_");
    expect(data.success).toBe(true);
    expect(m.generate).toHaveBeenCalledOnce();
  });

  it("keeps logger failure best-effort without printing a raw database error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.create.mockRejectedValue(new Error("database rejected argument " + fixtureToken));
    await expect(logAIInvocation({ ...base, promptPreview: "ordinary preview" })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]).toEqual(["[AI instrumentation] log failed"]);
  });

  it("refuses free-form supplied fingerprints while retaining supported digest encodings", async () => {
    await logAIInvocation({ ...base, promptHash: fixtureToken, promptPreview: "safe preview" });
    expect(m.create.mock.calls[0][0].data.promptHash).toMatch(/^h[a-z0-9]+$/);
    expect(JSON.stringify(m.create.mock.calls[0])).not.toContain(fixtureToken);
    const digest = "a".repeat(64);
    await logAIInvocation({ ...base, promptHash: digest });
    expect(m.create.mock.calls[1][0].data.promptHash).toBe(digest);
  });
  it("redacts known credentials in metadata and drops a contaminated correlation identifier", async () => {
    await logAIInvocation({ ...base, taskType: "task " + fixtureToken, provider: "provider " + fixtureToken, model: "model " + fixtureToken, requestId: fixtureToken });
    const data = m.create.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain(fixtureToken);
    expect(data.taskType).toContain("[REDACTED-GITHUB-PAT]");
    expect(data.provider).toContain("[REDACTED-GITHUB-PAT]");
    expect(data.model).toContain("[REDACTED-GITHUB-PAT]");
    expect(data.requestId).toBeUndefined();
    await logAIInvocation({ ...base, requestId: "req-safe-123" });
    expect(m.create.mock.calls[1][0].data).toMatchObject({ taskType: base.taskType, provider: base.provider, model: base.model, requestId: "req-safe-123" });
  });

});
