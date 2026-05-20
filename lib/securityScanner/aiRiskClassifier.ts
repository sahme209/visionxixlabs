/**
 * AI risk classifier.
 *
 * Given a raw security finding (resource id, control id, evidence
 * blob), produce an operator-readable severity classification + root-
 * cause hint. Best-effort: falls back to a deterministic mapping when
 * AI is unavailable.
 *
 * Severity ladder uses a closed union — the manager refuses unknown
 * labels and falls back instead of letting the model invent severities.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export type AiSeverity = "info" | "low" | "medium" | "high" | "critical";

const SEVERITIES: readonly AiSeverity[] = ["info", "low", "medium", "high", "critical"];

export interface ClassifyInput {
  resourceLabel: string;          // e.g. "S3 bucket axiom-public-prod"
  controlLabel: string;           // e.g. "S3 PAB block-public-acls"
  evidenceSnippet: string;        // operator-readable summary, <= 1000 chars
}

export interface RiskClassifyResult {
  severity: AiSeverity;
  rootCause: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}

const SYSTEM = [
  "You classify cloud security findings.",
  "Severity must be exactly one of: info, low, medium, high, critical.",
  "Reply with strictly one JSON object: { \"severity\": \"...\", \"rootCause\": \"<= 25 words\" }.",
  "Never invent severities outside the allowed list.",
].join(" ");

function deterministicFallback(input: ClassifyInput): RiskClassifyResult {
  // Coarse mapping for the fallback: control label keywords drive severity.
  const c = input.controlLabel.toLowerCase();
  const e = input.evidenceSnippet.toLowerCase();
  let severity: AiSeverity = "info";
  if (c.includes("public") || c.includes("open")) severity = "high";
  else if (c.includes("mfa") || c.includes("root") || c.includes("admin")) severity = "high";
  else if (c.includes("encryption") || c.includes("tls")) severity = "medium";
  else if (c.includes("log") || c.includes("audit")) severity = "low";
  if (e.includes("internet") || e.includes("0.0.0.0/0") || e.includes("anonymous")) severity = "critical";
  return {
    severity,
    rootCause: `${input.controlLabel} flagged "${input.resourceLabel}" (deterministic fallback).`,
    aiUsed: false, provider: null, model: null, latencyMs: 0,
  };
}

export async function classifyRisk(input: ClassifyInput): Promise<RiskClassifyResult> {
  const fallback = deterministicFallback(input);
  try {
    const mgr = getAIProviderManager();
    const prompt = [
      `Resource: ${input.resourceLabel}`,
      `Control: ${input.controlLabel}`,
      `Evidence: ${input.evidenceSnippet.slice(0, 1000)}`,
    ].join("\n");
    const r = await mgr.extractStructuredData<{ severity?: string; rootCause?: string }>(
      prompt,
      `{ "severity": "info | low | medium | high | critical", "rootCause": "<= 25 words" }`,
      { system: SYSTEM, temperature: 0, maxTokens: 4096, timeoutMs: 10_000 },
    );
    if (r.provider === "mock") return { ...fallback, latencyMs: r.latencyMs };
    const sev = String(r.data?.severity ?? "").toLowerCase();
    if (!SEVERITIES.includes(sev as AiSeverity)) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
    }
    const root = String(r.data?.rootCause ?? "").trim();
    return {
      severity: sev as AiSeverity,
      rootCause: root.length > 0 ? (root.length > 250 ? `${root.slice(0, 247)}...` : root) : fallback.rootCause,
      aiUsed: true,
      provider: r.provider,
      model: r.model,
      latencyMs: r.latencyMs,
    };
  } catch {
    return fallback;
  }
}
