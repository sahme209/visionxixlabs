/**
 * Agent scorecards (A14). Pure and deterministic.
 *
 * Summarises each agent's gateway history: how much it asked for, how often a
 * person approved or rejected it, how often policy denied it, and how often its
 * self-reported outcomes succeeded. The trust level is a plain-language
 * summary of that evidence, never an automatic permission: it does not change
 * any policy decision.
 */
export interface ScorecardRow {
  apiKeyId: string; agentName: string; status: string; policyDecision: string; riskLevel: string; outcome: string | null; createdAt: Date;
}
export type TrustLevel = "new" | "building" | "reliable" | "needs_review";
export interface AgentScorecard {
  apiKeyId: string; agentNames: string[]; requests: number;
  allowedByPolicy: number; approved: number; rejected: number; denied: number; pending: number;
  outcomesReported: number; succeeded: number; failed: number; abandoned: number; unreportedAfterApproval: number;
  highRiskRequests: number; successRate: number | null; approvalRate: number | null;
  trust: TrustLevel; trustReasons: string[]; lastSeenAt: string;
}

const MIN_HISTORY = 10;

export function buildScorecards(rows: readonly ScorecardRow[]): AgentScorecard[] {
  const byKey = new Map<string, ScorecardRow[]>();
  for (const r of rows) byKey.set(r.apiKeyId, [...(byKey.get(r.apiKeyId) ?? []), r]);
  const cards = [...byKey.entries()].map(([apiKeyId, list]) => scorecard(apiKeyId, list));
  return cards.sort((a, b) => b.requests - a.requests || (a.apiKeyId < b.apiKeyId ? -1 : 1));
}

function scorecard(apiKeyId: string, list: readonly ScorecardRow[]): AgentScorecard {
  const count = (f: (r: ScorecardRow) => boolean) => list.filter(f).length;
  const denied = count((r) => r.policyDecision === "deny");
  const allowedByPolicy = count((r) => r.policyDecision === "allow");
  const humanDecided = list.filter((r) => r.policyDecision === "require_approval" && r.status !== "pending");
  const rejected = humanDecided.filter((r) => r.status === "rejected").length;
  const approved = humanDecided.length - rejected;
  const pending = count((r) => r.status === "pending");
  const succeeded = count((r) => r.outcome === "succeeded");
  const failed = count((r) => r.outcome === "failed");
  const abandoned = count((r) => r.outcome === "abandoned");
  const outcomesReported = succeeded + failed + abandoned;
  const unreportedAfterApproval = count((r) => r.status === "approved" && r.outcome === null);
  const successRate = outcomesReported > 0 ? succeeded / outcomesReported : null;
  const approvalRate = humanDecided.length > 0 ? approved / humanDecided.length : null;

  const reasons: string[] = [];
  let trust: TrustLevel;
  if (list.length < MIN_HISTORY) { trust = "new"; reasons.push(`Only ${list.length} requests so far; at least ${MIN_HISTORY} are needed for a trend.`); }
  else if ((successRate !== null && successRate < 0.7) || (approvalRate !== null && approvalRate < 0.5) || denied / list.length > 0.2) {
    trust = "needs_review";
    if (successRate !== null && successRate < 0.7) reasons.push(`Reported success is ${Math.round(successRate * 100)}%.`);
    if (approvalRate !== null && approvalRate < 0.5) reasons.push(`People rejected ${Math.round((1 - approvalRate) * 100)}% of its approval requests.`);
    if (denied / list.length > 0.2) reasons.push(`Policy denied ${denied} of ${list.length} requests.`);
  } else if (successRate !== null && successRate >= 0.95 && outcomesReported >= MIN_HISTORY && unreportedAfterApproval <= 1) {
    trust = "reliable"; reasons.push(`${Math.round(successRate * 100)}% of ${outcomesReported} reported outcomes succeeded.`);
  } else { trust = "building"; reasons.push("A steady record so far, but not enough reported outcomes to call it reliable."); }
  if (unreportedAfterApproval > 2) reasons.push(`${unreportedAfterApproval} approved actions have no reported outcome.`);
  reasons.push("Outcomes are reported by the agent itself. Trust level never changes what policy allows.");

  return {
    apiKeyId, agentNames: [...new Set(list.map((r) => r.agentName))].sort().slice(0, 10), requests: list.length,
    allowedByPolicy, approved, rejected, denied, pending, outcomesReported, succeeded, failed, abandoned, unreportedAfterApproval,
    highRiskRequests: count((r) => r.riskLevel === "high"), successRate, approvalRate, trust, trustReasons: reasons,
    lastSeenAt: new Date(Math.max(...list.map((r) => r.createdAt.getTime()))).toISOString(),
  };
}
