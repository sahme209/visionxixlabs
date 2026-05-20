/**
 * Vitest unit tests for the AI usage logger.
 *
 * Critical invariants:
 *   - Never records prompts (the buffer's event shape excludes prompts
 *     entirely).
 *   - Bounded buffer.
 *   - summarizeUsage groups by provider and task.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clearUsage, readUsageTail, recordUsage, summarizeUsage } from "../AIUsageLogger";

describe("AIUsageLogger", () => {
  beforeEach(() => { clearUsage(); });

  it("clearUsage resets to empty", () => {
    recordUsage({ provider: "mock", model: "m", task: "generate_text", latencyMs: 1, status: "ok" });
    expect(readUsageTail().length).toBe(1);
    clearUsage();
    expect(readUsageTail().length).toBe(0);
  });

  it("event shape excludes prompts and secrets", () => {
    recordUsage({ provider: "mock", model: "m", task: "generate_text", latencyMs: 1, status: "ok" });
    const ev = readUsageTail(1)[0];
    expect(ev).toHaveProperty("provider");
    expect(ev).toHaveProperty("model");
    expect(ev).toHaveProperty("task");
    expect(ev).toHaveProperty("latencyMs");
    expect(ev).toHaveProperty("status");
    expect(ev).not.toHaveProperty("prompt");
    expect(ev).not.toHaveProperty("apiKey");
    expect(ev).not.toHaveProperty("token");
  });

  it("readUsageTail returns newest first", () => {
    recordUsage({ provider: "mock", model: "m1", task: "generate_text", latencyMs: 1, status: "ok" });
    recordUsage({ provider: "mock", model: "m2", task: "generate_text", latencyMs: 2, status: "ok" });
    const tail = readUsageTail();
    expect(tail[0].model).toBe("m2");
    expect(tail[1].model).toBe("m1");
  });

  it("bounded buffer caps growth at 500 events", () => {
    for (let i = 0; i < 600; i++) {
      recordUsage({ provider: "mock", model: `m${i}`, task: "generate_text", latencyMs: 1, status: "ok" });
    }
    expect(readUsageTail(1000).length).toBe(500);
  });

  it("summarizeUsage groups by provider and task with avg latency", () => {
    recordUsage({ provider: "github_models", model: "g1", task: "generate_text", latencyMs: 100, status: "ok" });
    recordUsage({ provider: "github_models", model: "g1", task: "generate_text", latencyMs: 300, status: "error", errorKind: "rate_limited" });
    recordUsage({ provider: "mock", model: "m1", task: "summarize", latencyMs: 50, status: "ok" });

    const s = summarizeUsage();
    expect(s.totalEvents).toBe(3);
    const gh = s.byProvider.find((p) => p.provider === "github_models")!;
    expect(gh.count).toBe(2);
    expect(gh.errors).toBe(1);
    expect(gh.avgLatencyMs).toBe(200);
    const summTask = s.byTask.find((t) => t.task === "summarize")!;
    expect(summTask.count).toBe(1);
  });
});
