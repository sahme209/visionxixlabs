import { describe, expect, it } from "vitest";
import { summarizeAiCostByTask, taskOf } from "../aiCostByTask";

const row = (over: Partial<Parameters<typeof taskOf>[0] & { model: string | null; inputTokens: number; outputTokens: number; billedCents: number; billingStatus: string }> = {}) => ({ eventKind: "ai_invocation", model: "anthropic/claude-sonnet", inputTokens: 100, outputTokens: 50, billedCents: 4, billingStatus: "settled", metadata: { route: "api/ai/generate" }, ...over });

describe("AI cost by task", () => {
  it("labels tasks from engine name, route or task kind", () => {
    expect(taskOf(row({ metadata: { engineName: "release-risk", route: "x" } }))).toBe("release-risk");
    expect(taskOf(row())).toBe("Agent and assistant replies");
    expect(taskOf(row({ metadata: { task: "extract_structured_data" } }))).toBe("Structured extraction");
    expect(taskOf(row({ eventKind: "agent_run", metadata: null }))).toBe("agent run");
  });
  it("totals calls, tokens and cost per task, keeping pending cost separate", () => {
    const out = summarizeAiCostByTask([
      row(), row({ billedCents: 6, billingStatus: "pending", model: "openai/gpt" }),
      row({ metadata: { task: "extract_structured_data" }, billedCents: 1 }),
      row({ eventKind: "api_v1_call", billedCents: 99 }),
    ]);
    expect(out.calls).toBe(3);
    expect(out.totalSettledCents).toBe(5);
    expect(out.totalPendingCents).toBe(6);
    expect(out.tasks[0]).toMatchObject({ task: "Agent and assistant replies", calls: 2, tokens: 300, settledCents: 4, pendingCents: 6, averageCents: 5, models: ["anthropic/claude-sonnet", "openai/gpt"] });
    expect(out.tasks[1]).toMatchObject({ task: "Structured extraction", calls: 1, averageCents: 1 });
  });
});
