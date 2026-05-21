/**
 * Pure meta-reasoner kernel — the agent that picks agents.
 *
 * Input: a typed operator problem (free text + a domain hint) + the
 * full kernel catalog with each kernel's declared capabilities +
 * historical accuracy scores. Output: a ranked list of candidate
 * kernels with confidence + rationale + an explicit "no_kernel"
 * verdict when nothing in the catalog fits.
 *
 * Pure / deterministic. Uses keyword + domain matching + historical
 * accuracy boost. No LLM call from here — the meta-reasoner is
 * itself a closed-union typed planner, by design.
 *
 * Why this matters for AGI:
 *   The hardest decision in a multi-agent system isn't "do this
 *   task" — it's "WHICH agent should do this task". A meta-reasoner
 *   makes that decision explicit + auditable.
 */

export type ProblemDomain =
  | "code"
  | "database"
  | "cloud_cost"
  | "cloud_security"
  | "observability"
  | "devops"
  | "incident"
  | "marketing"
  | "hr"
  | "sales"
  | "general";

export interface KernelCatalogEntry {
  /** Kernel id (matches lib/agents/<id>). */
  id: string;
  /** Domains the kernel is qualified for. */
  domains: ReadonlyArray<ProblemDomain>;
  /** Free-form keywords the kernel handles. */
  keywords: ReadonlyArray<string>;
  /** Historical accuracy 0..1 — from confidenceCalibrator. Default 0.5. */
  historicalAccuracy: number;
  /** True when kernel ships a dry-run path; affects ranking for risky tasks. */
  supportsDryRun: boolean;
  /** Operator-readable one-liner. */
  shortDescription: string;
}

export interface MetaReasonerProblem {
  /** Free-text problem statement. */
  statement: string;
  /** Operator-supplied domain hint, when known. */
  domainHint?: ProblemDomain;
  /** True when the operator stated the action could be destructive. */
  destructive?: boolean;
  /** True when this is a recurring scheduled job, not an ad-hoc question. */
  scheduled?: boolean;
}

export interface KernelMatch {
  kernelId: string;
  /** 0..1 confidence in this match. */
  confidence: number;
  /** Operator-readable reason this kernel was picked. */
  reason: string;
}

export type MetaReasonerVerdict =
  | { kind: "pick"; chosen: KernelMatch; runnersUp: readonly KernelMatch[] }
  | { kind: "ambiguous"; candidates: readonly KernelMatch[]; reason: string }
  | { kind: "no_kernel"; reason: string };

const STOPWORDS = new Set([
  "a", "an", "the", "is", "in", "on", "of", "for", "to", "with",
  "and", "or", "but", "we", "i", "you", "they", "this", "that", "be",
  "are", "was", "were", "do", "does", "did",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

const AMBIGUITY_GAP = 0.08;
const MIN_PICK_CONFIDENCE = 0.25;

export function selectKernelForProblem(
  problem: MetaReasonerProblem,
  catalog: ReadonlyArray<KernelCatalogEntry>,
): MetaReasonerVerdict {
  if (catalog.length === 0) {
    return { kind: "no_kernel", reason: "Catalog is empty." };
  }
  if (!problem.statement.trim()) {
    return { kind: "no_kernel", reason: "Problem statement is empty." };
  }

  const tokens = tokenize(problem.statement);

  // Score each kernel.
  const matches: KernelMatch[] = catalog.map((k) => {
    const keywordScore = jaccard(tokens, k.keywords.map((x) => x.toLowerCase()));

    // Domain hint hard match doubles the score; soft match adds 0.15.
    let domainBoost = 0;
    if (problem.domainHint) {
      if (k.domains.includes(problem.domainHint)) domainBoost = 0.25;
    } else {
      // Without a hint, give a tiny boost when a kernel covers "general".
      if (k.domains.includes("general")) domainBoost = 0.05;
    }

    // Historical accuracy contributes up to 0.2.
    const historyBoost = Math.max(0, Math.min(1, k.historicalAccuracy)) * 0.2;

    // Risky tasks prefer dry-run-capable kernels.
    const dryRunBoost = problem.destructive && k.supportsDryRun ? 0.1 : 0;

    const confidence = Math.min(1, keywordScore + domainBoost + historyBoost + dryRunBoost);

    const reasons: string[] = [];
    if (keywordScore > 0) reasons.push(`keyword overlap ${(keywordScore * 100).toFixed(0)}%`);
    if (domainBoost > 0)  reasons.push(`domain ${problem.domainHint ?? "general"}`);
    if (historyBoost > 0) reasons.push(`historical accuracy ${(k.historicalAccuracy * 100).toFixed(0)}%`);
    if (dryRunBoost > 0)  reasons.push("dry-run preferred for destructive task");

    return {
      kernelId: k.id,
      confidence,
      reason: reasons.length > 0
        ? reasons.join(" · ")
        : `Catalog candidate; no specific match signal.`,
    };
  });

  matches.sort((a, b) => b.confidence - a.confidence);
  const best = matches[0];
  const second = matches[1];

  if (best.confidence < MIN_PICK_CONFIDENCE) {
    return {
      kind: "no_kernel",
      reason: `Top match confidence ${(best.confidence * 100).toFixed(0)}% is below ${(MIN_PICK_CONFIDENCE * 100).toFixed(0)}% — surface for human triage.`,
    };
  }

  if (second && best.confidence - second.confidence < AMBIGUITY_GAP) {
    return {
      kind: "ambiguous",
      candidates: [best, second, ...(matches[2] ? [matches[2]] : [])],
      reason: `Top two candidates within ${(AMBIGUITY_GAP * 100).toFixed(0)}% of each other — ask operator to disambiguate.`,
    };
  }

  return {
    kind: "pick",
    chosen: best,
    runnersUp: matches.slice(1, 4),
  };
}
