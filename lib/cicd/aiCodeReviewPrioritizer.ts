/**
 * AI code-review prioritizer.
 *
 * Operator pastes a diff hunk + a list of lint/tsc/security-scanner
 * findings. The AI manager surfaces the 3-5 most reviewer-worthy
 * findings with a one-line rationale each. NEVER throws. Closed
 * priority union; the manager rejects hallucinated priorities.
 *
 * Approval-only-no-execution: this is advisory; no fix lands without
 * a human PR.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

export type ReviewFindingKind = "lint" | "type_error" | "security" | "style" | "test_gap" | "doc_drift";
export type ReviewPriority = "p0_blocking" | "p1_must_review" | "p2_consider" | "p3_nit";

export interface ReviewFinding {
  id: string;
  kind: ReviewFindingKind;
  /** Operator-readable summary. */
  detail: string;
  /** File path + optional line for the reviewer. */
  file: string;
  line?: number;
}

export interface ReviewPriorityRow {
  id: string;
  priority: ReviewPriority;
  rationale: string;
}

export interface ReviewPrioritizeResult {
  rows: ReviewPriorityRow[];
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  rejectionReason?: string;
}

const ALLOWED_PRIORITIES: readonly ReviewPriority[] = ["p0_blocking", "p1_must_review", "p2_consider", "p3_nit"];

const SYSTEM = [
  "You prioritize code-review findings for an AGI ops platform PR.",
  "Allowed priorities: p0_blocking, p1_must_review, p2_consider, p3_nit.",
  "Reply strictly as JSON: { \"rows\": [{ \"id\": \"<finding id>\", \"priority\": \"<one of allowed>\", \"rationale\": \"<= 25 words\" }] }.",
  "Never invent ids. Never invent priorities outside the allowed list.",
  "Mark security findings p0/p1, type_errors p1, lint-only p2/p3.",
].join(" ");

function deterministicPriority(f: ReviewFinding): ReviewPriority {
  if (f.kind === "security") return "p0_blocking";
  if (f.kind === "type_error") return "p1_must_review";
  if (f.kind === "test_gap") return "p1_must_review";
  if (f.kind === "doc_drift") return "p2_consider";
  // lint / style → p2 or p3 depending on text hint
  return /\b(error|forbidden|deprecated)\b/i.test(f.detail) ? "p2_consider" : "p3_nit";
}

function deterministicFallback(findings: readonly ReviewFinding[]): ReviewPriorityRow[] {
  return findings.map((f) => ({
    id: f.id,
    priority: deterministicPriority(f),
    rationale: `${f.kind} on ${f.file}${f.line ? `:${f.line}` : ""} — deterministic priority by kind.`,
  }));
}

export async function prioritizeReviewFindings(input: {
  findings: readonly ReviewFinding[];
  /** Optional diff hunk to give the AI context. ≤ 4000 chars. */
  diffHunk?: string;
}): Promise<ReviewPrioritizeResult> {
  const fallback: ReviewPrioritizeResult = {
    rows: deterministicFallback(input.findings),
    aiUsed: false, provider: null, model: null, latencyMs: 0,
  };
  if (input.findings.length === 0) return fallback;

  try {
    const mgr = getAIProviderManager();
    const findingsList = input.findings
      .map((f) => `- id=${f.id} kind=${f.kind} file=${f.file}${f.line ? `:${f.line}` : ""} | ${f.detail.slice(0, 200)}`)
      .join("\n");
    const diff = input.diffHunk ? `\n\nDiff hunk (truncated):\n${input.diffHunk.slice(0, 4000)}` : "";
    const prompt = `Findings:\n${findingsList}${diff}`;
    const r = await mgr.extractStructuredData<{ rows?: unknown }>(
      prompt,
      `{ "rows": [{ "id": "string (must match a finding id)", "priority": "p0_blocking | p1_must_review | p2_consider | p3_nit", "rationale": "string ≤ 25 words" }] }`,
      { system: SYSTEM, temperature: 0, maxTokens: 4096, timeoutMs: 15_000 },
    );
    if (r.provider === "mock") return { ...fallback, latencyMs: r.latencyMs };
    const arr = (r.data as { rows?: unknown }).rows;
    if (!Array.isArray(arr)) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "non_array_rows" };
    }
    const idSet = new Set(input.findings.map((f) => f.id));
    const cleaned: ReviewPriorityRow[] = [];
    for (const x of arr) {
      if (!x || typeof x !== "object" || Array.isArray(x)) continue;
      const id = String((x as { id?: unknown }).id ?? "");
      const priority = (x as { priority?: unknown }).priority;
      const rationale = String((x as { rationale?: unknown }).rationale ?? "").trim();
      if (!idSet.has(id)) continue;
      if (typeof priority !== "string" || !ALLOWED_PRIORITIES.includes(priority as ReviewPriority)) continue;
      if (rationale.length === 0) continue;
      cleaned.push({
        id,
        priority: priority as ReviewPriority,
        rationale: rationale.length > 220 ? `${rationale.slice(0, 217)}...` : rationale,
      });
    }
    if (cleaned.length === 0) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "no_valid_rows" };
    }
    // Sort by priority desc.
    const rank: Record<ReviewPriority, number> = { p0_blocking: 0, p1_must_review: 1, p2_consider: 2, p3_nit: 3 };
    cleaned.sort((a, b) => rank[a.priority] - rank[b.priority]);
    return { rows: cleaned, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { ...fallback, rejectionReason: "provider_threw" };
  }
}
