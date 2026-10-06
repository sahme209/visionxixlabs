/**
 * AIUsageLogger — process-local, structured-log usage tracker.
 *
 * Hard rules:
 *   - Never log API keys, tokens, secrets, or full user prompts.
 *   - Log only: provider, model, task, latency, status, error kind,
 *     correlationId.
 *   - Keep the buffer bounded (last 500 events) so a stuck process
 *     doesn't leak memory.
 *
 * Designed to be safe to call from anywhere; failures here must never
 * propagate.
 */

import "server-only";
import type { AIProviderName, AITaskKind } from "./AIProvider";

export interface UsageEvent {
  ts: string;
  /** Workspace attribution is required before an event can leave the service. */
  organizationId?: string;
  provider: AIProviderName;
  model: string;
  task: AITaskKind;
  latencyMs: number;
  status: "ok" | "error";
  /** Error kind if status==error; never the full message. */
  errorKind?: string;
  correlationId?: string;
}

const BUFFER: UsageEvent[] = [];
const MAX = 500;

export function recordUsage(event: Omit<UsageEvent, "ts"> & { ts?: string }): void {
  try {
    const ev: UsageEvent = { ts: event.ts ?? new Date().toISOString(), ...event };
    BUFFER.push(ev);
    if (BUFFER.length > MAX) BUFFER.shift();
    // Structured console line — operators can parse it. NO secrets, NO prompts.
    if (process.env.AI_USAGE_VERBOSE === "1") {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ scope: "ai_usage", ...ev }));
    }
  } catch {
    // Best-effort. Never propagate.
  }
}

export function readUsageTail(limit = 100): UsageEvent[] {
  return BUFFER.slice(-Math.max(1, Math.min(MAX, limit))).reverse();
}

/**
 * Returns only events explicitly attributed to a workspace. Legacy process
 * events without attribution deliberately remain service-internal.
 */
export function readUsageTailForOrganization(organizationId: string, limit = 100): UsageEvent[] {
  const bounded = Math.max(1, Math.min(MAX, limit));
  return BUFFER
    .filter((event) => event.organizationId === organizationId)
    .slice(-bounded)
    .reverse();
}

export function clearUsage(): number {
  const n = BUFFER.length;
  BUFFER.length = 0;
  return n;
}

export interface UsageSummary {
  totalEvents: number;
  byProvider: Array<{ provider: AIProviderName; count: number; errors: number; avgLatencyMs: number }>;
  byTask: Array<{ task: AITaskKind; count: number; errors: number }>;
}

export function summarizeUsage(events: readonly UsageEvent[] = BUFFER): UsageSummary {
  const perProvider = new Map<AIProviderName, { count: number; errors: number; latencySum: number }>();
  const perTask = new Map<AITaskKind, { count: number; errors: number }>();
  for (const e of events) {
    const p = perProvider.get(e.provider) ?? { count: 0, errors: 0, latencySum: 0 };
    p.count += 1;
    p.latencySum += e.latencyMs;
    if (e.status === "error") p.errors += 1;
    perProvider.set(e.provider, p);
    const t = perTask.get(e.task) ?? { count: 0, errors: 0 };
    t.count += 1;
    if (e.status === "error") t.errors += 1;
    perTask.set(e.task, t);
  }
  return {
    totalEvents: events.length,
    byProvider: [...perProvider.entries()].map(([provider, v]) => ({
      provider, count: v.count, errors: v.errors,
      avgLatencyMs: v.count === 0 ? 0 : Math.round(v.latencySum / v.count),
    })).sort((a, b) => b.count - a.count),
    byTask: [...perTask.entries()].map(([task, v]) => ({ task, count: v.count, errors: v.errors }))
      .sort((a, b) => b.count - a.count),
  };
}
