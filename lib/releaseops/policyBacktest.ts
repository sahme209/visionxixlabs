/**
 * Policy backtesting (agentic automation, later item). Pure.
 *
 * Replays recorded policy violations from recent releases under the current rules and a proposed policy
 * document, so a reviewer sees what the change would have done: which releases would now be blocked,
 * which would no longer be blocked, and which rules drive that. A release is blocked when an enabled,
 * blocking rule was violated without a recorded exception (or the rule allows no exceptions). Rules a
 * proposal adds have no recorded violations yet, so their effect is reported as unknown, not zero.
 */
import type { PolicyDocument } from "./policyAsCode";

export interface BacktestRule { key: string; enabled: boolean; blocking: boolean; exceptionAllowed: boolean }
export interface BacktestViolation { releaseId: string; ruleKey: string; exceptionGranted: boolean }
export interface PolicyBacktest {
  releases: number;
  blockedNow: number;
  blockedProposed: number;
  newlyBlocked: string[];
  newlyUnblocked: string[];
  byRule: Array<{ key: string; blockedNow: number; blockedProposed: number }>;
  rulesWithoutHistory: string[];
}

function blockingKeys(rules: readonly BacktestRule[]): Map<string, BacktestRule> {
  return new Map(rules.filter((r) => r.enabled && r.blocking).map((r) => [r.key, r]));
}
function blockedBy(v: BacktestViolation, rules: Map<string, BacktestRule>): boolean {
  const rule = rules.get(v.ruleKey);
  return Boolean(rule) && !(v.exceptionGranted && rule!.exceptionAllowed);
}

export function backtestPolicy(current: readonly BacktestRule[], proposed: PolicyDocument, violations: readonly BacktestViolation[], releaseIds: readonly string[]): PolicyBacktest {
  const now = blockingKeys(current);
  const next = blockingKeys(proposed.rules);
  const releases = [...new Set(releaseIds)];
  const blockedSet = (rules: Map<string, BacktestRule>) => new Set(violations.filter((v) => blockedBy(v, rules)).map((v) => v.releaseId));
  const a = blockedSet(now), b = blockedSet(next);
  const keys = [...new Set([...now.keys(), ...next.keys()])].sort();
  const byRule = keys.map((key) => {
    const forKey = violations.filter((v) => v.ruleKey === key);
    return { key, blockedNow: new Set(forKey.filter((v) => blockedBy(v, now)).map((v) => v.releaseId)).size, blockedProposed: new Set(forKey.filter((v) => blockedBy(v, next)).map((v) => v.releaseId)).size };
  }).filter((r) => r.blockedNow !== r.blockedProposed);
  const known = new Set(current.map((r) => r.key));
  return {
    releases: releases.length,
    blockedNow: a.size,
    blockedProposed: b.size,
    newlyBlocked: [...b].filter((id) => !a.has(id)).sort(),
    newlyUnblocked: [...a].filter((id) => !b.has(id)).sort(),
    byRule,
    rulesWithoutHistory: proposed.rules.filter((r) => !known.has(r.key)).map((r) => r.key).sort(),
  };
}
