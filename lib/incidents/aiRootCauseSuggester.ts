/**
 * AI root-cause suggester.
 *
 * Given an incident summary + recent telemetry hints, produce three
 * candidate root causes ranked by confidence and one suggested
 * mitigation each. Approval-only-no-execution — mitigations are
 * suggestions, never auto-applied.
 *
 * Best-effort: NEVER throws. Falls back to a deterministic candidate
 * list when AI is unavailable.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export interface IncidentSeed {
  incidentLabel: string;          // "p95 latency spike in checkout"
  service: string;                // "checkout-api"
  observedAt: string;             // ISO timestamp
  /** Compact bullet list of telemetry deltas (<= 1500 chars total). */
  telemetryHints: string[];
}

export interface RcaCandidate {
  cause: string;                  // <= 25 words
  confidence: number;             // 0..1
  suggestedMitigation: string;    // <= 30 words; always advisory
}

export interface RcaResult {
  candidates: RcaCandidate[];
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  rejectionReason?: string;
}

const SYSTEM = [
  "You suggest 3 candidate root causes for an ops incident with mitigations.",
  "Reply strictly as JSON: { \"candidates\": [{ \"cause\": \"<= 25 words\", \"confidence\": 0..1, \"suggestedMitigation\": \"<= 30 words\" }, ...] }.",
  "Mitigations are SUGGESTIONS — never imply they are auto-applied.",
  "Never invent telemetry beyond the supplied hints.",
].join(" ");

const MAX_CAUSE = 200;
const MAX_MIT = 240;

const clamp01 = (n: unknown): number => {
  const v = typeof n === "number" ? n : 0.5;
  return Math.max(0, Math.min(1, v));
};

function templateFallback(seed: IncidentSeed): RcaCandidate[] {
  return [
    {
      cause: `Recent deploy to ${seed.service} introduced a regression.`,
      confidence: 0.4,
      suggestedMitigation: "Stage a runbook to roll back the most recent deploy (advisory; not auto-executed).",
    },
    {
      cause: `Downstream dependency of ${seed.service} is saturated or rate-limited.`,
      confidence: 0.3,
      suggestedMitigation: "Compare downstream error/latency dashboards; consider widening connection pool (advisory).",
    },
    {
      cause: `Capacity headroom at this hour is insufficient for current traffic on ${seed.service}.`,
      confidence: 0.3,
      suggestedMitigation: "Stage an HPA / desired-count increase via runbook (advisory; review before applying).",
    },
  ];
}

export async function suggestRootCauses(seed: IncidentSeed): Promise<RcaResult> {
  const fallback = templateFallback(seed);
  try {
    const mgr = getAIProviderManager();
    const hints = seed.telemetryHints.join("\n- ").slice(0, 1500);
    const prompt = [
      `Incident: ${seed.incidentLabel}`,
      `Service: ${seed.service}`,
      `Observed at: ${seed.observedAt}`,
      `Telemetry hints:`,
      hints ? `- ${hints}` : "(none)",
    ].join("\n");
    const r = await mgr.extractStructuredData<{ candidates?: unknown }>(
      prompt,
      `{ "candidates": [{ "cause": "string", "confidence": "number 0..1", "suggestedMitigation": "string" }] }`,
      { system: SYSTEM, temperature: 0.2, maxTokens: 4096, timeoutMs: 15_000 },
    );
    if (r.provider === "mock") {
      return { candidates: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    const arr = (r.data as { candidates?: unknown }).candidates;
    if (!Array.isArray(arr) || arr.length === 0) {
      return { candidates: fallback, aiUsed: false, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_non_array" };
    }
    const cleaned: RcaCandidate[] = [];
    for (const c of arr.slice(0, 5)) {
      if (!c || typeof c !== "object" || Array.isArray(c)) continue;
      const cause = String((c as { cause?: unknown }).cause ?? "").trim();
      const mit = String((c as { suggestedMitigation?: unknown }).suggestedMitigation ?? "").trim();
      if (cause.length === 0 || mit.length === 0) continue;
      cleaned.push({
        cause: cause.length > MAX_CAUSE ? `${cause.slice(0, MAX_CAUSE - 3)}...` : cause,
        confidence: clamp01((c as { confidence?: unknown }).confidence),
        suggestedMitigation: mit.length > MAX_MIT ? `${mit.slice(0, MAX_MIT - 3)}...` : mit,
      });
    }
    if (cleaned.length === 0) {
      return { candidates: fallback, aiUsed: false, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_no_valid_candidates" };
    }
    cleaned.sort((a, b) => b.confidence - a.confidence);
    return { candidates: cleaned, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { candidates: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0, rejectionReason: "provider_threw" };
  }
}
