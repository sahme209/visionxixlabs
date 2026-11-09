/**
 * Policy replay kernel (A12). Pure and deterministic.
 *
 * "What would this draft approval policy have done to the last N days of real
 * actions?" Replays historical approval items through the CURRENT policies and
 * a DRAFT policy set using the same resolver production uses
 * (resolveWithDefaults), then reports every action whose outcome would change.
 * Nothing is enabled or saved by a replay.
 *
 * Limits, stated in the result: history does not record a finding category, so
 * rules with category criteria are skipped and named; savings use the item's
 * recorded yearly high estimate.
 */
import { resolveWithDefaults, type ApprovalPolicyDef, type ApprovalTarget, type PolicyMatch } from "@/lib/axiom/agent/rbacEngine";

export interface HistoricalAction {
  id: string; title: string; createdAt: Date; status: string;
  riskLevel: ApprovalTarget["riskLevel"]; actionType: ApprovalTarget["actionType"]; provider: ApprovalTarget["provider"];
  disposition: ApprovalTarget["disposition"]; yearlyHigh: number;
}
export type ReplayOutcome = "blocked" | "needs_approval" | "auto";
export interface ReplayChange { id: string; title: string; createdAt: string; riskLevel: string; actionType: string; before: ReplayOutcome; after: ReplayOutcome; beforeApprovals: number; afterApprovals: number; beforePolicy: string; afterPolicy: string }
export interface ReplayResult {
  window: { from: string; to: string; actions: number };
  totals: { before: Record<ReplayOutcome, number>; after: Record<ReplayOutcome, number> };
  changes: ReplayChange[];
  newlyBlocked: number; newlyAutoApproved: number; stricter: number; looser: number;
  limits: string[];
}

const outcomeOf = (m: PolicyMatch): ReplayOutcome => (m.blocked ? "blocked" : m.requiredApprovals > 0 ? "needs_approval" : "auto");
const rank: Record<ReplayOutcome, number> = { auto: 0, needs_approval: 1, blocked: 2 };
/** Category is not recorded on history, so rules that require a category cannot be evaluated and are skipped (never widened). */
const evaluable = (ps: readonly ApprovalPolicyDef[]) => ps.filter((p) => p.matchCategories.length === 0);

export function replayPolicies(input: { current: readonly ApprovalPolicyDef[]; draft: readonly ApprovalPolicyDef[]; history: readonly HistoricalAction[]; from: Date; to: Date; maxChanges?: number }): ReplayResult {
  const current = evaluable(input.current); const draft = evaluable(input.draft);
  const skipped = [...input.current, ...input.draft].filter((p) => p.matchCategories.length > 0 && p.enabled).map((p) => p.name);
  const zero = (): Record<ReplayOutcome, number> => ({ auto: 0, needs_approval: 0, blocked: 0 });
  const before = zero(); const after = zero(); const changes: ReplayChange[] = [];
  let newlyBlocked = 0, newlyAutoApproved = 0, stricter = 0, looser = 0;
  const ordered = [...input.history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
  for (const h of ordered) {
    const target: ApprovalTarget = { riskLevel: h.riskLevel, actionType: h.actionType, provider: h.provider, category: "cost" as ApprovalTarget["category"], yearlySavings: Number.isFinite(h.yearlyHigh) ? h.yearlyHigh : 0, disposition: h.disposition };
    const b = resolveWithDefaults(current, target); const a = resolveWithDefaults(draft, target);
    const bo = outcomeOf(b); const ao = outcomeOf(a);
    before[bo]++; after[ao]++;
    if (bo !== ao || b.requiredApprovals !== a.requiredApprovals) {
      if (ao === "blocked" && bo !== "blocked") newlyBlocked++;
      if (ao === "auto" && bo !== "auto") newlyAutoApproved++;
      if (rank[ao] > rank[bo] || (ao === bo && a.requiredApprovals > b.requiredApprovals)) stricter++; else looser++;
      if (changes.length < (input.maxChanges ?? 200)) changes.push({ id: h.id, title: h.title.slice(0, 200), createdAt: h.createdAt.toISOString(), riskLevel: String(h.riskLevel), actionType: String(h.actionType), before: bo, after: ao, beforeApprovals: b.requiredApprovals, afterApprovals: a.requiredApprovals, beforePolicy: b.policy.name, afterPolicy: a.policy.name });
    }
  }
  return {
    window: { from: input.from.toISOString(), to: input.to.toISOString(), actions: ordered.length },
    totals: { before, after }, changes, newlyBlocked, newlyAutoApproved, stricter, looser,
    limits: [
      skipped.length ? `Skipped rules that match on finding category (not stored with history): ${[...new Set(skipped)].join(", ")}.` : "No category-specific rules needed skipping.",
      "Savings use each action's recorded yearly high estimate.",
      "A replay shows policy outcomes only. It does not show what people would have decided.",
    ],
  };
}
