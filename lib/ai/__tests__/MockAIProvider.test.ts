/**
 * Vitest unit tests for the MockAIProvider — the last-resort fallback.
 *
 * Critical invariants:
 *   - Always isConfigured() → no env required
 *   - generateText never throws
 *   - extractStructuredData returns valid JSON
 *   - streamText yields at least one chunk + a terminal done frame
 *   - classify produces a label drawn from the supplied set
 */

import { describe, it, expect } from "vitest";
import { MockAIProvider } from "../providers/MockAIProvider";

describe("MockAIProvider", () => {
  const p = new MockAIProvider();

  it("is always configured", () => {
    expect(p.isConfigured()).toBe(true);
  });

  it("generateText echoes a MOCK marker so callers can't confuse it with real output", async () => {
    const r = await p.generateText("hello world");
    expect(r.text).toContain("[MOCK");
    expect(r.provider).toBe("mock");
    expect(r.finishReason).toBe("stop");
  });

  it("summarize truncates long input", async () => {
    const long = "x".repeat(300);
    const r = await p.summarize(long);
    expect(r.text).toContain("[MOCK summary]");
    expect(r.text.length).toBeLessThan(long.length);
  });

  it("classify picks a label from the supplied set", async () => {
    const r = await p.classify("the quick brown fox", ["positive", "negative", "neutral"]);
    expect(["positive", "negative", "neutral"]).toContain(r.label);
    expect(r.scores.length).toBe(3);
    // sorted by score desc
    expect(r.scores[0].score).toBeGreaterThanOrEqual(r.scores[r.scores.length - 1].score);
  });

  it("classify with empty label set returns 'unknown'", async () => {
    const r = await p.classify("hello", []);
    expect(r.label).toBe("unknown");
  });

  it("extractStructuredData returns valid JSON", async () => {
    const r = await p.extractStructuredData<{ _mock: true; echo: string; schemaHint: string }>("here is some text", "{ x: number }");
    expect(r.data._mock).toBe(true);
    expect(r.data.echo).toContain("here is some text");
    expect(() => JSON.parse(r.raw)).not.toThrow();
  });

  it("streamText yields at least one chunk and ends with done", async () => {
    const chunks: Array<{ text: string; done: boolean }> = [];
    for await (const c of p.streamText("hello world this is a test")) {
      chunks.push(c);
    }
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[chunks.length - 1].done).toBe(true);
  });

  it("healthCheck returns ok=true", async () => {
    const r = await p.healthCheck();
    expect(r.ok).toBe(true);
    expect(r.provider).toBe("mock");
  });
});
