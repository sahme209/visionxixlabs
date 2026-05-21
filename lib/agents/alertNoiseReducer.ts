/**
 * Pure alert noise reducer.
 *
 * Input: alert statistics per alert rule over an observation window —
 * fire count, mean duration, ack rate, paired incident count, and the
 * current threshold + window. Output: a typed proposal per rule:
 * raise_threshold / widen_window / require_paired_metric / mute /
 * keep, with closed-union verdict + rationale.
 *
 * Pure / deterministic. Caller fetches the stats from the
 * observability connector; this kernel never touches them.
 */

export type NoiseVerdict =
  | "raise_threshold"
  | "widen_window"
  | "require_paired_metric"
  | "mute_temporarily"
  | "split_routing"
  | "keep";

export type RiskTier = "low" | "medium" | "high";

export interface AlertStats {
  /** Stable rule id. */
  ruleId: string;
  /** Display name. */
  ruleName: string;
  /** Channel the alert lands in. */
  channel: "slack" | "teams" | "pagerduty" | "email";
  /** Window of observation in days (e.g. 7). */
  windowDays: number;
  /** Times the alert fired in the window. */
  fires: number;
  /** Number of fires that an operator acknowledged. */
  ackedFires: number;
  /** Number of fires that produced a real incident row. */
  incidentsCreated: number;
  /** Current threshold expression — e.g. "cpu>80% for 5m". */
  currentThreshold: string;
  /** Whether the alert already pairs with a second predicate. */
  hasPairedPredicate: boolean;
  /** Optional: linked SLO id. */
  sloId?: string;
}

export interface NoiseProposal {
  id: string;
  ruleId: string;
  verdict: NoiseVerdict;
  riskTier: RiskTier;
  /** Operator-readable rationale. */
  rationale: string;
  /** Closed-union recommendation card. */
  recommendation:
    | { kind: "raise_threshold"; current: string; suggested: string }
    | { kind: "widen_window"; current: string; suggested: string }
    | { kind: "require_paired_metric"; suggestedPair: string }
    | { kind: "mute_temporarily"; durationHours: number }
    | { kind: "split_routing"; lowSeverityChannel: string; highSeverityChannel: string }
    | { kind: "no_change" };
  /** Expected fire-rate reduction (0..1). */
  expectedReductionPct: number;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `noise-${counter}`;
}
export function __resetNoiseCounter(): void { counter = 0; }

// Heuristics:
//   ack rate = ackedFires / fires
//   incident rate = incidentsCreated / fires
//
// • fires=0      → keep (nothing to optimise).
// • incidents==0 + many fires → noise → raise_threshold OR mute.
// • acked but no incidents → require paired metric to disambiguate.
// • acked + incidents both high → keep, this is signal.
// • paged but slack-acked only → split_routing.

const NOISE_FLOOR_PER_DAY = 5; // a rule firing > 5x/day with zero incidents is loud

export function proposeNoiseReductions(
  inputs: readonly AlertStats[],
): readonly NoiseProposal[] {
  const out: NoiseProposal[] = [];
  for (const stats of inputs) {
    out.push(propose(stats));
  }
  // Sort by expected reduction desc.
  return [...out].sort((a, b) => b.expectedReductionPct - a.expectedReductionPct);
}

function suggestedThresholdRaise(current: string): string {
  // Best-effort: bump a "X%" threshold by 10 percentage points if present.
  const pctPattern = /(\d{1,3})(\s*%)/;
  const m = pctPattern.exec(current);
  if (m) {
    const cur = parseInt(m[1], 10);
    const raised = Math.min(99, cur + 10);
    return current.replace(pctPattern, `${raised}$2`);
  }
  return `${current} (raise by 10%)`;
}

function suggestedWindowWiden(current: string): string {
  // Best-effort: bump "for 5m" to "for 10m" — double the window.
  const m = /for\s+(\d+)\s*(m|min|s|sec|h)/i.exec(current);
  if (m) {
    const value = parseInt(m[1], 10);
    return current.replace(m[0], `for ${value * 2}${m[2]}`);
  }
  return `${current} (widen window 2×)`;
}

function propose(stats: AlertStats): NoiseProposal {
  if (stats.fires === 0) {
    return {
      id: nextId(),
      ruleId: stats.ruleId,
      verdict: "keep",
      riskTier: "low",
      rationale: "Rule did not fire in the observation window — no optimisation needed.",
      recommendation: { kind: "no_change" },
      expectedReductionPct: 0,
    };
  }

  const ackRate = stats.fires > 0 ? stats.ackedFires / stats.fires : 0;
  const incidentRate = stats.fires > 0 ? stats.incidentsCreated / stats.fires : 0;
  const firesPerDay = stats.fires / Math.max(stats.windowDays, 1);
  const loudish = firesPerDay > NOISE_FLOOR_PER_DAY;

  // Case A: completely silent operators (ack < 10%) + no incidents → mute.
  if (ackRate < 0.1 && stats.incidentsCreated === 0 && loudish) {
    return {
      id: nextId(),
      ruleId: stats.ruleId,
      verdict: "mute_temporarily",
      riskTier: "medium",
      rationale: `Rule fired ${stats.fires}x in ${stats.windowDays}d but ack rate is ${(ackRate * 100).toFixed(0)}% and incidents=0. Operator behavior already treats it as noise — mute for 72h to confirm.`,
      recommendation: { kind: "mute_temporarily", durationHours: 72 },
      expectedReductionPct: 1,
    };
  }

  // Case B: loud + no incidents → raise threshold.
  if (loudish && stats.incidentsCreated === 0) {
    return {
      id: nextId(),
      ruleId: stats.ruleId,
      verdict: "raise_threshold",
      riskTier: "low",
      rationale: `${firesPerDay.toFixed(1)} fires/day with zero incidents created — raise threshold to reduce noise.`,
      recommendation: { kind: "raise_threshold", current: stats.currentThreshold, suggested: suggestedThresholdRaise(stats.currentThreshold) },
      expectedReductionPct: 0.6,
    };
  }

  // Case C: loud + acked but no incidents → pair with second predicate.
  if (loudish && ackRate > 0.5 && incidentRate < 0.1 && !stats.hasPairedPredicate) {
    return {
      id: nextId(),
      ruleId: stats.ruleId,
      verdict: "require_paired_metric",
      riskTier: "medium",
      rationale: `Operators ack but don't open incidents — alert lacks specificity. Pair with a second predicate (e.g. request_error_rate > 1%) to suppress benign fires.`,
      recommendation: { kind: "require_paired_metric", suggestedPair: "request_error_rate > 1%" },
      expectedReductionPct: 0.45,
    };
  }

  // Case D: loud + window too narrow → widen window.
  if (loudish && /for\s+\d+\s*(m|min|s|sec)/i.test(stats.currentThreshold)) {
    return {
      id: nextId(),
      ruleId: stats.ruleId,
      verdict: "widen_window",
      riskTier: "low",
      rationale: "Loud rule with narrow window — widen the eval window to suppress transient spikes.",
      recommendation: { kind: "widen_window", current: stats.currentThreshold, suggested: suggestedWindowWiden(stats.currentThreshold) },
      expectedReductionPct: 0.35,
    };
  }

  // Case E: paged via PagerDuty but always acked in Slack → split routing.
  if (stats.channel === "pagerduty" && ackRate > 0.8 && incidentRate < 0.2) {
    return {
      id: nextId(),
      ruleId: stats.ruleId,
      verdict: "split_routing",
      riskTier: "medium",
      rationale: "Always acked, rarely incidents → too noisy for the page channel. Send low severity to Slack, keep paging for high severity.",
      recommendation: { kind: "split_routing", lowSeverityChannel: "slack", highSeverityChannel: "pagerduty" },
      expectedReductionPct: 0.5,
    };
  }

  // Case F: signal — keep.
  return {
    id: nextId(),
    ruleId: stats.ruleId,
    verdict: "keep",
    riskTier: "low",
    rationale: `Fire rate + incident rate (${(incidentRate * 100).toFixed(0)}%) indicate the rule is producing signal — no change.`,
    recommendation: { kind: "no_change" },
    expectedReductionPct: 0,
  };
}

export interface NoiseSummary {
  totalRules: number;
  expectedSilenceFiresPerWeek: number;
  byVerdict: Readonly<Record<NoiseVerdict, number>>;
}

export function summarizeNoise(
  inputs: readonly AlertStats[],
  proposals: readonly NoiseProposal[],
): NoiseSummary {
  const byVerdict: Record<NoiseVerdict, number> = {
    raise_threshold: 0, widen_window: 0, require_paired_metric: 0,
    mute_temporarily: 0, split_routing: 0, keep: 0,
  };
  let expectedSilence = 0;
  for (const p of proposals) {
    byVerdict[p.verdict] += 1;
    const stats = inputs.find((s) => s.ruleId === p.ruleId);
    if (stats) {
      expectedSilence += (stats.fires / Math.max(stats.windowDays, 1)) * 7 * p.expectedReductionPct;
    }
  }
  return {
    totalRules: proposals.length,
    expectedSilenceFiresPerWeek: Math.round(expectedSilence),
    byVerdict,
  };
}
