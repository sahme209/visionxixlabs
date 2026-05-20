/**
 * AI security playbook generator.
 *
 * Given a finding + tenant context, produce an ordered list of
 * 3-7 advisory steps the operator should take. Strict closed-union
 * step-type validation. NEVER auto-executes.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

const ALLOWED_STEP_TYPES = [
  "contain", "investigate", "remediate_propose", "notify", "evidence_capture", "verify",
] as const;
export type PlaybookStepType = (typeof ALLOWED_STEP_TYPES)[number];

export interface PlaybookFindingSeed {
  controlId: string;            // e.g. "s3-pab"
  severity: "info" | "low" | "medium" | "high" | "critical";
  resourceLabel: string;        // operator-readable
  evidenceSnippet: string;
}

export interface PlaybookStep {
  order: number;
  type: PlaybookStepType;
  action: string;              // <= 30 words
  rationale: string;           // <= 25 words
}

export interface PlaybookResult {
  steps: PlaybookStep[];
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  rejectionReason?: string;
}

const SYSTEM = [
  "You generate an ordered advisory security playbook (3-7 steps) for a finding.",
  "Allowed step types: contain, investigate, remediate_propose, notify, evidence_capture, verify.",
  "Mitigations are ADVISORY only — never imply auto-execution.",
  "Reply strictly as JSON: { \"steps\": [{ \"order\": 1..n, \"type\": \"<one of types>\", \"action\": \"<= 30 words\", \"rationale\": \"<= 25 words\" }] }.",
].join(" ");

function deterministicPlaybook(seed: PlaybookFindingSeed): PlaybookStep[] {
  return [
    { order: 1, type: "contain",            action: `Restrict access to ${seed.resourceLabel} until investigation completes.`, rationale: "Limit blast radius while we confirm scope." },
    { order: 2, type: "investigate",        action: `Pull recent CloudTrail + access logs for ${seed.resourceLabel}.`,         rationale: "Determine whether exposure was exploited." },
    { order: 3, type: "remediate_propose",  action: `Stage a runbook to remediate ${seed.controlId}.`,                          rationale: "Operator reviews before any state change (advisory)." },
    { order: 4, type: "evidence_capture",   action: `Snapshot the relevant config + access logs into the evidence packet.`,    rationale: "Auditor-ready record." },
    { order: 5, type: "verify",             action: `After remediation lands via IaC, confirm the control returns to compliant.`, rationale: "Closes the loop." },
  ];
}

const isValidStepType = (s: unknown): s is PlaybookStepType =>
  typeof s === "string" && (ALLOWED_STEP_TYPES as readonly string[]).includes(s);

export async function generateSecurityPlaybook(seed: PlaybookFindingSeed): Promise<PlaybookResult> {
  const fallback = deterministicPlaybook(seed);
  try {
    const mgr = getAIProviderManager();
    const prompt = [
      `Control: ${seed.controlId}`,
      `Severity: ${seed.severity}`,
      `Resource: ${seed.resourceLabel}`,
      `Evidence: ${seed.evidenceSnippet.slice(0, 1000)}`,
    ].join("\n");
    const r = await mgr.extractStructuredData<{ steps?: unknown }>(
      prompt,
      `{ "steps": [{ "order": "integer", "type": "contain | investigate | remediate_propose | notify | evidence_capture | verify", "action": "string", "rationale": "string" }] }`,
      { system: SYSTEM, temperature: 0.2, maxTokens: 4096, timeoutMs: 15_000 },
    );
    if (r.provider === "mock") {
      return { steps: fallback, aiUsed: false, provider: null, model: null, latencyMs: r.latencyMs };
    }
    const arr = (r.data as { steps?: unknown }).steps;
    if (!Array.isArray(arr) || arr.length === 0) {
      return { steps: fallback, aiUsed: false, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "non_array_steps" };
    }
    const cleaned: PlaybookStep[] = [];
    let idx = 1;
    for (const s of arr.slice(0, 7)) {
      if (!s || typeof s !== "object" || Array.isArray(s)) continue;
      const type = (s as { type?: unknown }).type;
      const action = String((s as { action?: unknown }).action ?? "").trim();
      const rationale = String((s as { rationale?: unknown }).rationale ?? "").trim();
      if (!isValidStepType(type) || action.length === 0 || rationale.length === 0) continue;
      cleaned.push({
        order: idx,
        type,
        action: action.length > 250 ? `${action.slice(0, 247)}...` : action,
        rationale: rationale.length > 220 ? `${rationale.slice(0, 217)}...` : rationale,
      });
      idx += 1;
    }
    if (cleaned.length < 3) {
      return { steps: fallback, aiUsed: false, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "fewer_than_3_valid_steps" };
    }
    return { steps: cleaned, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { steps: fallback, aiUsed: false, provider: null, model: null, latencyMs: 0, rejectionReason: "provider_threw" };
  }
}
