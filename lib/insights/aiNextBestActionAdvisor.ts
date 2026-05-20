/**
 * AI Next-Best-Action advisor.
 *
 * Given an aggregate operator-readable picture of the tenant's
 * platform (drift count, SLO burn rate, pending proposals, autonomy
 * cycle health), suggest up to 3 ranked next actions the operator
 * should take. Each suggestion includes an estimated effort tier
 * (low | medium | high) and a category.
 *
 * Best-effort: NEVER throws. Deterministic fallback when AI is
 * unavailable.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export type ActionCategory = "security" | "cost" | "reliability" | "compliance" | "governance";
export type EffortTier = "low" | "medium" | "high";

const CATEGORIES: readonly ActionCategory[] = ["security", "cost", "reliability", "compliance", "governance"];
const EFFORTS: readonly EffortTier[] = ["low", "medium", "high"];

export interface NbaSeed {
  pendingProposals: number;
  driftFindings: number;
  sloBurningServices: number;
  outboundFailuresLast24h: number;
  autonomyCyclesLast24h: number;
  dissentCountLast7d: number;
}

export interface NbaAction {
  title: string;          // <= 80 chars
  rationale: string;      // <= 30 words
  category: ActionCategory;
  effort: EffortTier;
}

export interface NbaResult {
  actions: NbaAction[];
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  rejectionReason?: string;
}

const SYSTEM = [
  "You are an AGI ops platform's next-best-action advisor.",
  "Pick up to 3 actions the operator should take this hour, ranked.",
  "Allowed categories: security, cost, reliability, compliance, governance.",
  "Allowed effort tiers: low, medium, high.",
  "Reply strictly as JSON: { \"actions\": [{ \"title\": \"...\", \"rationale\": \"...\", \"category\": \"...\", \"effort\": \"...\" }] }.",
  "Never invent categories or effort tiers. Never suggest auto-applying changes.",
].join(" ");

function templateFallback(seed: NbaSeed): NbaAction[] {
  const out: NbaAction[] = [];
  if (seed.pendingProposals > 0) {
    out.push({
      title: `Review ${seed.pendingProposals} pending method proposal${seed.pendingProposals === 1 ? "" : "s"}.`,
      rationale: "Pending proposals can't ship until an operator decides — clears the agents' improvement queue.",
      category: "governance", effort: "low",
    });
  }
  if (seed.driftFindings > 0) {
    out.push({
      title: `Review ${seed.driftFindings} drift finding${seed.driftFindings === 1 ? "" : "s"} against desired state.`,
      rationale: "Drift between Terraform and live cloud state usually precedes outages.",
      category: "reliability", effort: "medium",
    });
  }
  if (seed.sloBurningServices > 0) {
    out.push({
      title: `Investigate ${seed.sloBurningServices} service${seed.sloBurningServices === 1 ? "" : "s"} burning error budget.`,
      rationale: "Burn rate exceeds budget pace — quickest reliability win this hour.",
      category: "reliability", effort: "high",
    });
  }
  if (out.length === 0) {
    out.push({
      title: "Spot-check the autonomy cockpit and recent rationale rows.",
      rationale: "No urgent signal surfaced — quick scan keeps the operator in the loop.",
      category: "governance", effort: "low",
    });
  }
  return out.slice(0, 3);
}

export async function adviseNextActions(seed: NbaSeed): Promise<NbaResult> {
  const fallback = templateFallback(seed);
  try {
    const mgr = getAIProviderManager();
    const prompt = [
      `Pending proposals: ${seed.pendingProposals}`,
      `Drift findings: ${seed.driftFindings}`,
      `SLO-burning services: ${seed.sloBurningServices}`,
      `Outbound failures last 24h: ${seed.outboundFailuresLast24h}`,
      `Autonomy cycles last 24h: ${seed.autonomyCyclesLast24h}`,
      `Council dissent count last 7d: ${seed.dissentCountLast7d}`,
    ].join("\n");
    const r = await mgr.extractStructuredData<{ actions?: unknown }>(
      prompt,
      `{ "actions": [{ "title": "string <= 80 chars", "rationale": "string <= 30 words", "category": "security | cost | reliability | compliance | governance", "effort": "low | medium | high" }] }`,
      { system: SYSTEM, temperature: 0.2, maxTokens: 4096, timeoutMs: 15_000 },
    );
    if (r.provider === "mock") {
      return { actions: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    const arr = (r.data as { actions?: unknown }).actions;
    if (!Array.isArray(arr) || arr.length === 0) {
      return { actions: fallback, aiUsed: false, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_non_array" };
    }
    const cleaned: NbaAction[] = [];
    for (const c of arr.slice(0, 5)) {
      if (!c || typeof c !== "object" || Array.isArray(c)) continue;
      const title = String((c as { title?: unknown }).title ?? "").trim();
      const rationale = String((c as { rationale?: unknown }).rationale ?? "").trim();
      const cat = String((c as { category?: unknown }).category ?? "").trim();
      const eff = String((c as { effort?: unknown }).effort ?? "").trim();
      if (title.length === 0 || rationale.length === 0) continue;
      if (!(CATEGORIES as readonly string[]).includes(cat)) continue;
      if (!(EFFORTS as readonly string[]).includes(eff)) continue;
      cleaned.push({
        title: title.length > 200 ? `${title.slice(0, 197)}...` : title,
        rationale: rationale.length > 240 ? `${rationale.slice(0, 237)}...` : rationale,
        category: cat as ActionCategory,
        effort: eff as EffortTier,
      });
    }
    if (cleaned.length === 0) {
      return { actions: fallback, aiUsed: false, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "no_valid_actions" };
    }
    return { actions: cleaned.slice(0, 3), aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { actions: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0, rejectionReason: "provider_threw" };
  }
}
