/**
 * Per-engineer cost rollup — Phase 625.
 *
 * Reads recent AiCallLog rows for a workspace, groups by engineName,
 * and computes the total cost in cents over the window. Uses the
 * same computeInvocationCost helper as the existing billing path
 * (Phase 381) — no parallel pricing logic.
 *
 * Provider inference from the model string:
 *   · claude-*                          → anthropic
 *   · gpt-*, o1, o3, o4 (any prefix)    → openai
 *   · otherwise                          → unknown (cost: 0)
 * Mirrors the heuristic the existing rollupAiCallCost uses.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { ensureProviderRate } from "@/lib/billing/ensureProviderRate";
import { computeInvocationCost } from "@/lib/billing/computeInvocationCost";

export type EngineerProvider = "anthropic" | "openai" | "unknown";

export interface EngineerCostRow {
  engineName: string;
  callCount: number;
  okCount: number;
  errorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCents: number;
  provider: EngineerProvider;
  /** Models the engineer was observed using in the window. */
  models: ReadonlyArray<string>;
}

export interface EngineerCostRollup {
  windowDays: number;
  rows: ReadonlyArray<EngineerCostRow>;
  totalCents: number;
  totalCalls: number;
}

function inferProvider(model: string | null | undefined): EngineerProvider {
  if (!model) return "unknown";
  const lower = model.toLowerCase();
  if (lower.startsWith("claude")) return "anthropic";
  if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4")) return "openai";
  return "unknown";
}

interface PerModelTotals {
  input: number;
  output: number;
  provider: EngineerProvider;
  modelId: string;
  hits: number;
}

interface EngineBucket {
  callCount: number;
  okCount: number;
  errorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  perModel: Map<string, PerModelTotals>;
}

export async function buildEngineerCostRollup(
  organizationId: string,
  windowDays = 30,
): Promise<EngineerCostRollup> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  let rows: Array<{
    engineName: string;
    model: string | null;
    outcome: string;
    promptTokens: number | null;
    completionTokens: number | null;
  }> = [];
  try {
    rows = await prisma.aiCallLog.findMany({
      where: { organizationId, startedAt: { gte: since } },
      select: { engineName: true, model: true, outcome: true, promptTokens: true, completionTokens: true },
      take: 5000,
    });
  } catch {
    rows = [];
  }

  // First pass: aggregate by engineName, splitting tokens per (provider, model).
  const byEngine = new Map<string, EngineBucket>();
  for (const r of rows) {
    const bucket = byEngine.get(r.engineName) ?? {
      callCount: 0, okCount: 0, errorCount: 0,
      totalInputTokens: 0, totalOutputTokens: 0,
      perModel: new Map(),
    };
    bucket.callCount += 1;
    if (r.outcome === "ok") bucket.okCount += 1;
    else if (r.outcome === "error") bucket.errorCount += 1;
    const input = r.promptTokens ?? 0;
    const output = r.completionTokens ?? 0;
    bucket.totalInputTokens += input;
    bucket.totalOutputTokens += output;
    if (r.model) {
      const provider = inferProvider(r.model);
      const key = `${provider}::${r.model}`;
      const existing = bucket.perModel.get(key) ?? { input: 0, output: 0, provider, modelId: r.model, hits: 0 };
      existing.input += input;
      existing.output += output;
      existing.hits += 1;
      bucket.perModel.set(key, existing);
    }
    byEngine.set(r.engineName, bucket);
  }

  // Second pass: look up rates and compute cost per (engineName, provider, model).
  const out: EngineerCostRow[] = [];
  let totalCents = 0;
  for (const [engineName, bucket] of byEngine.entries()) {
    let engineerCents = 0;
    let dominantProvider: EngineerProvider = "unknown";
    let dominantHits = 0;
    const models = new Set<string>();

    for (const [, m] of bucket.perModel.entries()) {
      models.add(m.modelId);
      if (m.hits > dominantHits) { dominantProvider = m.provider; dominantHits = m.hits; }
      if (m.provider === "unknown") continue;
      const rate = await ensureProviderRate(m.provider, m.modelId);
      if (!rate) continue;
      const breakdown = computeInvocationCost(
        { inputTokens: m.input, outputTokens: m.output },
        rate,
      );
      engineerCents += breakdown.totalCents;
    }

    out.push({
      engineName,
      callCount: bucket.callCount,
      okCount: bucket.okCount,
      errorCount: bucket.errorCount,
      totalInputTokens: bucket.totalInputTokens,
      totalOutputTokens: bucket.totalOutputTokens,
      totalCents: engineerCents,
      provider: dominantProvider,
      models: Array.from(models),
    });
    totalCents += engineerCents;
  }

  out.sort((a, b) => b.totalCents - a.totalCents);

  return {
    windowDays,
    rows: out,
    totalCents,
    totalCalls: rows.length,
  };
}
