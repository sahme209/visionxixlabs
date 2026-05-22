/**
 * AI provider router — Phase 383.
 *
 * Pure function. Given a closed-union task kind, returns the
 * (provider, model, effort) the platform should call. The point is
 * margin protection: hard / long-horizon reasoning gets Opus or
 * Sonnet; classification + summarization gets Haiku; embeddings get
 * the cheapest provider model with embedding support. Every route
 * must point at a model in PROVIDER_RATE_SEEDS so the cost path can
 * price it (verified by a test).
 *
 * Lives in lib/ai so future call sites (orchestrator, lint summary,
 * security review) all funnel through one rule set.
 */

import type { ProviderRateSeed } from "@/lib/billing/providerRateSeeds";
import { PROVIDER_RATE_SEEDS } from "@/lib/billing/providerRateSeeds";

export type AITaskKind =
  | "code_propose"          // deep coding work — Sonnet 4.6
  | "code_lint_summary"     // condense lint output — Haiku 4.5
  | "code_test_summary"     // condense test failures — Haiku 4.5
  | "classification"        // tag/label — Haiku 4.5
  | "summarization"         // condense docs/reports — Haiku 4.5
  | "deep_reasoning"        // hardest analysis — Opus 4.7
  | "security_analysis"     // security-critical reasoning — Opus 4.7
  | "incident_triage"       // incident commander — Opus 4.7
  | "agent_run_default";    // catch-all for an agent run — Sonnet 4.6

export type AIEffort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AIRouteDecision {
  provider: "anthropic" | "openai";
  model: string;
  effort: AIEffort;
  rationale: string;
}

const ROUTES: Record<AITaskKind, AIRouteDecision> = {
  code_propose: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    effort: "high",
    rationale: "Coding workloads: Sonnet 4.6 is the operator's chosen default — strong code, fast turnaround, 64K output.",
  },
  code_lint_summary: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    effort: "low",
    rationale: "Condensing lint output into a one-line summary — Haiku is sufficient and 3x cheaper than Sonnet.",
  },
  code_test_summary: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    effort: "low",
    rationale: "Condensing test failures — Haiku handles the structured-text extraction at low cost.",
  },
  classification: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    effort: "low",
    rationale: "Single-label classification — Haiku at low effort matches Sonnet quality at ~30% of the cost.",
  },
  summarization: {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    effort: "low",
    rationale: "Short-form summarization — Haiku is the right choice unless the operator explicitly opts up.",
  },
  deep_reasoning: {
    provider: "anthropic",
    model: "claude-opus-4-7",
    effort: "high",
    rationale: "Long-horizon, multi-step reasoning — Opus 4.7 is the most capable model available.",
  },
  security_analysis: {
    provider: "anthropic",
    model: "claude-opus-4-7",
    effort: "high",
    rationale: "Security-critical analysis — never downgrade. Opus 4.7 catches what Sonnet misses.",
  },
  incident_triage: {
    provider: "anthropic",
    model: "claude-opus-4-7",
    effort: "high",
    rationale: "Incident commander needs deep reasoning under time pressure.",
  },
  agent_run_default: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    effort: "medium",
    rationale: "Catch-all for an arbitrary agent run — Sonnet 4.6 at medium effort balances cost and capability.",
  },
};

/**
 * Pure router. Does not consult the workspace plan — call sites that
 * need plan-aware downgrade (e.g. Starter forced to Haiku for cost
 * containment) should layer that decision on top.
 */
export function routeAITask(kind: AITaskKind): AIRouteDecision {
  return ROUTES[kind];
}

/** Returns every distinct (provider, model) referenced by the router. */
export function routedModels(): ReadonlyArray<{ provider: string; modelId: string }> {
  const seen = new Set<string>();
  const out: Array<{ provider: string; modelId: string }> = [];
  for (const r of Object.values(ROUTES)) {
    const key = `${r.provider}:${r.model}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ provider: r.provider, modelId: r.model });
    }
  }
  return out;
}

/**
 * Helper for tests / startup checks: every model the router can
 * return must exist in PROVIDER_RATE_SEEDS so the cost path can
 * price it. Returns the list of unbacked routes (empty when healthy).
 */
export function findUnpricedRoutes(): ReadonlyArray<{ provider: string; modelId: string }> {
  const seeds = new Set(PROVIDER_RATE_SEEDS.map((s: ProviderRateSeed) => `${s.provider}:${s.modelId}`));
  return routedModels().filter((r) => !seeds.has(`${r.provider}:${r.modelId}`));
}
