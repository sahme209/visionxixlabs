/**
 * Phase 531 — AI call log responder.
 *
 * Three surfaces:
 *   • persistAiCallLog — best-effort write of one call's record.
 *   • lookupCircuitState — derives circuit state for an engine by
 *     reading the recent window and applying the pure engine.
 *   • buildAiCallLogResponse — paginated read for the engineer
 *     dashboard with per-engine breakdown.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  computeCircuitState,
  computeEngineStats,
  type CallSummary,
  type CircuitState,
  type CircuitConfig,
  type OutcomeRow,
  type EngineStats,
} from "./aiCallLogEngine";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface CallLogRow {
  id: string;
  organizationId: string | null;
  engineName: string;
  model: string | null;
  outcome: string;
  errorMessage: string | null;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  startedAt: Date;
}

export interface AiCallLogRepo {
  aiCallLog: {
    create(args: {
      data: {
        organizationId: string | null;
        engineName: string;
        model: string | null;
        outcome: string;
        errorMessage: string | null;
        latencyMs: number;
        promptTokens: number | null;
        completionTokens: number | null;
        totalTokens: number | null;
      };
    }): Promise<CallLogRow>;
    findMany(args: {
      where: { engineName?: string; organizationId?: string | null };
      orderBy: { startedAt: "desc" };
      take?: number;
    }): Promise<CallLogRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Views.
   ────────────────────────────────────────────────────────────── */

export interface CallLogView {
  id: string;
  organizationId: string | null;
  engineName: string;
  model: string | null;
  outcome: string;
  errorMessage: string | null;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  startedAtIso: string;
}

export interface EngineBreakdown {
  engineName: string;
  state: CircuitState;
  stats: EngineStats;
}

export interface LogData {
  generatedAt: string;
  calls: CallLogView[];
  engines: EngineBreakdown[];
  summary: {
    total: number;
    ok: number;
    error: number;
    timeout: number;
    shortCircuit: number;
    totalLatencyMs: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
  };
}

export type ApiResponse<T> =
  | { status: number; body: { ok: true; data: T } }
  | { status: number; body: { ok: false; error: string; hint?: string } };

/* ──────────────────────────────────────────────────────────────────
   Persistence.
   ────────────────────────────────────────────────────────────── */

export interface PersistInput {
  organizationId: string | null;
  engineName: string;
  model: string | null;
  outcome: string;
  errorMessage: string | null;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

/**
 * Best-effort persist. Returns null on any failure — call sites must
 * not block the AI call on log persistence.
 */
export async function persistAiCallLog(
  repo: AiCallLogRepo,
  input: PersistInput,
): Promise<CallLogView | null> {
  try {
    const row = await repo.aiCallLog.create({ data: input });
    return rowToView(row);
  } catch {
    return null;
  }
}

function rowToView(row: CallLogRow): CallLogView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    engineName: row.engineName,
    model: row.model,
    outcome: row.outcome,
    errorMessage: row.errorMessage,
    latencyMs: row.latencyMs,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    startedAtIso: row.startedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Circuit state lookup.
   ────────────────────────────────────────────────────────────── */

/**
 * Compute the circuit state for an engine from the persisted log.
 * Returns "closed" on any read failure — fail-open is safer than
 * permanently blocking AI calls due to a log read glitch.
 */
export async function lookupCircuitState(
  repo: AiCallLogRepo,
  engineName: string,
  now: Date,
  config: Partial<CircuitConfig> = {},
): Promise<CircuitState> {
  const windowSize = config.windowSize ?? 10;
  try {
    const rows = await repo.aiCallLog.findMany({
      where: { engineName },
      orderBy: { startedAt: "desc" },
      take: windowSize,
    });
    const outcomes: OutcomeRow[] = rows.map((r) => ({ outcome: r.outcome, startedAt: r.startedAt }));
    return computeCircuitState(outcomes, now, config);
  } catch {
    return "closed";
  }
}

/* ──────────────────────────────────────────────────────────────────
   Engineer dashboard read.
   ────────────────────────────────────────────────────────────── */

export interface LogInput {
  /** When provided, scopes the call list (not the per-engine breakdown). */
  engineName?: string;
  /** When provided, scopes by org. null means "global / unscoped". */
  organizationId?: string | null;
  /** How many recent calls to return. Default 100, max 500. */
  take?: number;
  /** Override for circuit state config — engineers may want a tighter view. */
  circuitConfig?: Partial<CircuitConfig>;
  now?: Date;
}

export async function buildAiCallLogResponse(
  repo: AiCallLogRepo,
  input: LogInput = {},
): Promise<ApiResponse<LogData>> {
  const take = Math.max(1, Math.min(500, input.take ?? 100));
  const now = input.now ?? new Date();

  try {
    const calls = await repo.aiCallLog.findMany({
      where: {
        ...(input.engineName ? { engineName: input.engineName } : {}),
        ...(input.organizationId !== undefined ? { organizationId: input.organizationId } : {}),
      },
      orderBy: { startedAt: "desc" },
      take,
    });

    // Compute the breakdown per engine — derive distinct engines from
    // the call window so engines without recent activity don't show up.
    const byEngine = new Map<string, CallLogRow[]>();
    for (const c of calls) {
      const prev = byEngine.get(c.engineName);
      if (prev) prev.push(c);
      else byEngine.set(c.engineName, [c]);
    }

    const engines: EngineBreakdown[] = [];
    for (const [engineName, engineCalls] of byEngine.entries()) {
      const outcomes: OutcomeRow[] = engineCalls.map((c) => ({ outcome: c.outcome, startedAt: c.startedAt }));
      const summaries: CallSummary[] = engineCalls.map((c) => ({
        outcome: c.outcome,
        latencyMs: c.latencyMs,
        totalTokens: c.totalTokens,
        promptTokens: c.promptTokens,
        completionTokens: c.completionTokens,
      }));
      engines.push({
        engineName,
        state: computeCircuitState(outcomes, now, input.circuitConfig),
        stats: computeEngineStats(summaries),
      });
    }
    // Stable sort: most active engine first.
    engines.sort((a, b) => b.stats.windowSize - a.stats.windowSize);

    let ok = 0, errored = 0, timedOut = 0, shorted = 0;
    let totalLatency = 0, totalPrompt = 0, totalCompletion = 0;
    for (const c of calls) {
      if (c.outcome === "ok") ok++;
      else if (c.outcome === "error") errored++;
      else if (c.outcome === "timeout") timedOut++;
      else if (c.outcome === "short_circuit") shorted++;
      if (c.outcome !== "short_circuit") totalLatency += c.latencyMs;
      if (typeof c.promptTokens === "number") totalPrompt += c.promptTokens;
      if (typeof c.completionTokens === "number") totalCompletion += c.completionTokens;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          calls: calls.map(rowToView),
          engines,
          summary: {
            total: calls.length,
            ok,
            error: errored,
            timeout: timedOut,
            shortCircuit: shorted,
            totalLatencyMs: totalLatency,
            totalPromptTokens: totalPrompt,
            totalCompletionTokens: totalCompletion,
          },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528190000_add_ai_call_log." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "read_failed", hint: err instanceof Error ? err.message : "unknown" },
    };
  }
}
