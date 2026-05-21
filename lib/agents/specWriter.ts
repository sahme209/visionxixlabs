/**
 * Pure AGI-Engineer spec writer.
 *
 * Input: an operator's problem statement plus optional context lines
 * and stated constraints. Output: a typed engineering spec with
 * goals, non-goals, risks, verification, and rollback sections.
 *
 * Why this kernel exists: every AGI Engineer change should start
 * with a spec the operator can read in 90 seconds and either
 * approve, reject, or amend. Skipping this step is how autonomy
 * accumulates technical debt.
 *
 * Closed unions on spec kind + risk tier so future kinds break the
 * build. Pure / deterministic.
 */

export type SpecKind = "bug_fix" | "feature" | "refactor" | "migration" | "investigation";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface SpecInput {
  problem: string;
  /** Optional supporting evidence — log line, commit ref, ticket id, screenshot caption. */
  context?: readonly string[];
  /** Operator-stated constraints. e.g. "no schema change". */
  constraints?: readonly string[];
}

export interface SpecDraft {
  id: string;
  kind: SpecKind;
  title: string;
  /** One-sentence positioning, never longer than 160 chars. */
  summary: string;
  goals: readonly string[];
  nonGoals: readonly string[];
  risks: readonly { tier: RiskTier; statement: string }[];
  verification: readonly string[];
  rollback: string;
  /** Agents that should evaluate the resulting proposal next. */
  expectedNextAgents: ReadonlyArray<"simulator" | "policy_gate" | "boundary_gate" | "approver">;
}

const KEYWORDS_BY_KIND: Record<SpecKind, readonly string[]> = {
  bug_fix:       ["bug", "broken", "regress", "fix", "incorrect", "fails", "error", "crash", "leak"],
  feature:       ["add", "introduce", "build", "ship", "new", "support", "enable"],
  refactor:      ["refactor", "clean up", "extract", "rename", "simplify", "tidy", "restructure"],
  migration:     ["migrate", "migration", "schema", "rename column", "drop table", "backfill", "upgrade dependency"],
  investigation: ["investigate", "why", "diagnose", "audit", "find out", "understand"],
};

const HIGH_RISK_PATTERNS = [
  /\b(prod(?:uction)?|live|customers?|payments?|billing|delete|drop|truncate|migrate|migration|schema|secret|credential|kev|cve|outage|incident)\b/i,
];

const CRITICAL_RISK_PATTERNS = [
  /\b(data\s*loss|destructive|irreversible|cascading|wipe)\b/i,
];

/** Classify a problem statement into a closed-union spec kind. */
function classifyKind(problem: string): SpecKind {
  const p = problem.toLowerCase();
  let best: { kind: SpecKind; hits: number } = { kind: "investigation", hits: -1 };
  for (const kind of Object.keys(KEYWORDS_BY_KIND) as SpecKind[]) {
    const hits = KEYWORDS_BY_KIND[kind].reduce((acc, kw) => (p.includes(kw) ? acc + 1 : acc), 0);
    if (hits > best.hits) best = { kind, hits };
  }
  return best.hits > 0 ? best.kind : "investigation";
}

function tierFor(text: string): RiskTier {
  if (CRITICAL_RISK_PATTERNS.some((r) => r.test(text))) return "critical";
  if (HIGH_RISK_PATTERNS.some((r) => r.test(text))) return "high";
  if (/\b(refactor|rename|extract|cleanup)\b/i.test(text)) return "low";
  return "medium";
}

function titleFromProblem(problem: string): string {
  const first = problem.split(/[.!?\n]/, 1)[0].trim();
  const compact = first.replace(/\s+/g, " ");
  return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
}

function summaryFromProblem(problem: string, kind: SpecKind): string {
  const tag = kind.replace("_", " ");
  const body = problem.replace(/\s+/g, " ").trim();
  const max = 160 - tag.length - 3;
  const trimmed = body.length > max ? `${body.slice(0, max - 1)}…` : body;
  return `[${tag}] ${trimmed}`;
}

function goalsFor(kind: SpecKind, problem: string): readonly string[] {
  switch (kind) {
    case "bug_fix":
      return [
        "Restore the documented behavior described in the problem statement.",
        "Add a regression test that fails before the fix and passes after.",
      ];
    case "feature":
      return [
        "Ship the smallest version that exercises the full feature path end-to-end.",
        "Cover the golden path with a vitest test before merging.",
        "Surface a typed interface so downstream agents can consume the new event.",
      ];
    case "refactor":
      return [
        "Preserve external behavior — no caller of the affected modules should change.",
        "Tighten internal types so future changes break the build instead of runtime.",
      ];
    case "migration":
      return [
        "Land the migration behind a backwards-compatible window: write to old + new shape, read from new.",
        "Provide a forward + reverse migration script with idempotency.",
      ];
    case "investigation":
      return [
        "Produce a 1-pager with the root cause, evidence trail, and recommended next action.",
        "Decide go / no-go on whether a follow-up fix or feature spec is warranted.",
      ];
  }
  // exhaustiveness — unreachable
  return [problem];
}

function nonGoalsFor(kind: SpecKind): readonly string[] {
  switch (kind) {
    case "bug_fix":
      return ["Refactoring surrounding code beyond what's needed to make the test pass.", "Adding features."];
    case "feature":
      return ["Premature optimization.", "Backwards-compat shims for clients that don't exist."];
    case "refactor":
      return ["Changing observable behavior.", "Adding features under the cover of cleanup."];
    case "migration":
      return ["Combining unrelated schema changes into the same migration."];
    case "investigation":
      return ["Shipping a fix in the same pass — investigation outputs a follow-up spec, not a patch."];
  }
  return [];
}

function risksFor(kind: SpecKind, problem: string, constraints: readonly string[]): readonly { tier: RiskTier; statement: string }[] {
  const baseTier = tierFor(`${problem} ${constraints.join(" ")}`);
  const r: { tier: RiskTier; statement: string }[] = [];
  switch (kind) {
    case "bug_fix":
      r.push({ tier: baseTier, statement: "Regression in adjacent code paths if the fix changes a shared helper." });
      break;
    case "feature":
      r.push({ tier: baseTier, statement: "Feature surface widens API contracts — needs typed event + closed-union update." });
      break;
    case "refactor":
      r.push({ tier: baseTier === "critical" ? "high" : baseTier, statement: "Refactor risks behavior change if tests don't cover the seam." });
      break;
    case "migration":
      r.push({ tier: baseTier === "low" ? "medium" : baseTier, statement: "Schema migration cannot be partially applied — needs idempotent forward + reverse." });
      r.push({ tier: "high", statement: "Concurrent writes during the backwards-compat window may double-write." });
      break;
    case "investigation":
      r.push({ tier: "low", statement: "Investigation output may bias the follow-up spec — invite a second reasoner pass." });
      break;
  }
  return r;
}

function verificationFor(kind: SpecKind): readonly string[] {
  switch (kind) {
    case "bug_fix":      return ["Failing regression test added.", "Existing vitest suite green.", "Lint + tsc clean."];
    case "feature":      return ["Golden-path vitest test added.", "Sad-path vitest test added.", "tsc clean.", "Manual smoke in the cockpit if the feature is operator-visible."];
    case "refactor":     return ["All affected modules retain their existing tests.", "tsc clean.", "No exported-symbol diff (verified with `git diff --stat` on declaration files)."];
    case "migration":    return ["Forward migration applied on a copy of prod data.", "Reverse migration applied + verified.", "Idempotency: running the migration twice is a no-op."];
    case "investigation": return ["Investigation 1-pager attached.", "Recommended next action listed with go / no-go verdict."];
  }
  return [];
}

function rollbackFor(kind: SpecKind): string {
  switch (kind) {
    case "bug_fix":       return "Revert the commit. Regression test stays as proof of the original failure.";
    case "feature":       return "Feature flag the entry point; flipping the flag disables the feature without a redeploy.";
    case "refactor":      return "Revert the commit. Because behavior is preserved, no downstream cleanup is needed.";
    case "migration":     return "Run the reverse migration script. If schema went through a backwards-compat window, stop dual writes first.";
    case "investigation": return "N/A — investigation is read-only.";
  }
  return "Revert the commit.";
}

function nextAgentsFor(kind: SpecKind, tier: RiskTier): SpecDraft["expectedNextAgents"] {
  const base: SpecDraft["expectedNextAgents"][number][] = ["simulator", "policy_gate", "approver"];
  if (kind === "migration" || tier === "critical" || tier === "high") {
    base.splice(2, 0, "boundary_gate");
  }
  return base;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `spec-${counter}`;
}

/** Reset the in-process counter — only intended for tests. */
export function __resetSpecCounter(): void {
  counter = 0;
}

export function draftSpec(input: SpecInput): SpecDraft {
  const problem = (input.problem ?? "").trim();
  if (!problem) {
    throw new Error("specWriter: problem statement is required");
  }
  const kind = classifyKind(problem);
  const constraints = input.constraints ?? [];
  const baseline = tierFor(`${problem} ${constraints.join(" ")}`);
  const kindRisks = risksFor(kind, problem, constraints);
  // Surface the baseline tier as a discrete row when it exceeds any
  // kind-specific risk — keeps data-loss language visible even on an
  // investigation spec that would otherwise read as low-risk.
  const maxKindTier = kindRisks.reduce<RiskTier>((acc, r) => higherTier(acc, r.tier), "low");
  const risks = TIER_ORDER[baseline] > TIER_ORDER[maxKindTier]
    ? [...kindRisks, { tier: baseline, statement: `Problem statement language implies ${baseline}-tier impact.` }]
    : kindRisks;
  const overallTier: RiskTier = risks.reduce<RiskTier>((acc, r) => higherTier(acc, r.tier), "low");
  return {
    id: nextId(),
    kind,
    title: titleFromProblem(problem),
    summary: summaryFromProblem(problem, kind),
    goals: goalsFor(kind, problem),
    nonGoals: nonGoalsFor(kind),
    risks,
    verification: verificationFor(kind),
    rollback: rollbackFor(kind),
    expectedNextAgents: nextAgentsFor(kind, overallTier),
  };
}

const TIER_ORDER: Record<RiskTier, number> = { low: 0, medium: 1, high: 2, critical: 3 };
function higherTier(a: RiskTier, b: RiskTier): RiskTier {
  return TIER_ORDER[a] >= TIER_ORDER[b] ? a : b;
}
