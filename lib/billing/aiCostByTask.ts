/**
 * Measured AI cost per task (A7) from recorded usage events (pure). A task is the most specific label the
 * caller recorded: the engine name, else the route, else the task kind. Pending (not yet settled) cost is
 * counted separately so nothing pending is presented as final.
 */
export interface AiUsageRow { eventKind: string; model: string | null; inputTokens: number; outputTokens: number; billedCents: number; billingStatus: string; metadata: unknown }
export interface AiTaskCost { task: string; calls: number; tokens: number; settledCents: number; pendingCents: number; averageCents: number | null; models: string[] }

const TASK_LABEL: Record<string, string> = {
  "extract_structured_data": "Structured extraction",
  "api/ai/generate": "Agent and assistant replies",
  "pipeline/code_propose": "Coding proposals",
  "releaseops/instrumented_fetcher": "Release analysis",
  "api/insights/tenant": "Workspace insights",
  "api/workflows/translate": "Workflow translation",
};

export function taskOf(row: Pick<AiUsageRow, "eventKind" | "metadata">): string {
  const m = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {};
  const raw = [m.engineName, m.route, m.task].find((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 120) ?? row.eventKind;
  return TASK_LABEL[raw] ?? raw.replaceAll("_", " ");
}

export function summarizeAiCostByTask(rows: readonly AiUsageRow[]): { tasks: AiTaskCost[]; totalSettledCents: number; totalPendingCents: number; calls: number } {
  const map = new Map<string, AiTaskCost & { _models: Set<string> }>();
  let totalSettledCents = 0, totalPendingCents = 0;
  for (const r of rows) {
    if (r.eventKind !== "ai_invocation" && r.eventKind !== "agent_run") continue;
    const task = taskOf(r);
    const t = map.get(task) ?? { task, calls: 0, tokens: 0, settledCents: 0, pendingCents: 0, averageCents: null, models: [], _models: new Set<string>() };
    t.calls += 1;
    t.tokens += Math.max(0, r.inputTokens) + Math.max(0, r.outputTokens);
    const cents = Math.max(0, r.billedCents);
    if (r.billingStatus === "pending") { t.pendingCents += cents; totalPendingCents += cents; } else { t.settledCents += cents; totalSettledCents += cents; }
    if (r.model) t._models.add(r.model);
    map.set(task, t);
  }
  const tasks = [...map.values()].map(({ _models, ...t }) => ({ ...t, models: [..._models].sort(), averageCents: t.calls ? Math.round(((t.settledCents + t.pendingCents) / t.calls) * 10) / 10 : null }))
    .sort((a, b) => (b.settledCents + b.pendingCents) - (a.settledCents + a.pendingCents) || b.calls - a.calls || a.task.localeCompare(b.task));
  return { tasks, totalSettledCents, totalPendingCents, calls: tasks.reduce((n, t) => n + t.calls, 0) };
}
