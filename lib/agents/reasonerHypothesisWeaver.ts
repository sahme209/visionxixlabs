/**
 * Pure reasoner-agent hypothesis weaver.
 *
 * Detector agents emit signals; the reasoner agent's job is to weave
 * 1..N signals into a typed hypothesis with a confidence + an expected-
 * outcome statement that downstream agents (simulator / policy_gate /
 * boundary_gate) can evaluate.
 *
 * Pure / deterministic. Closed unions on signal + hypothesis kind so
 * future kinds break the build.
 */

export type SignalKind = "drift" | "cost_anomaly" | "slo_burn" | "vuln_kev" | "policy_violation" | "saturation";

export interface DetectorSignal {
  id: string;
  kind: SignalKind;
  /** Single resource id or service id this signal points to. */
  target: string;
  /** 0..1 detector confidence. */
  confidence: number;
  /** Operator-readable evidence snippet. */
  evidence: string;
}

export type HypothesisKind =
  | "drift_remediation_needed"
  | "cost_breach_imminent"
  | "slo_burn_active"
  | "exploit_window_open"
  | "policy_drift_detected"
  | "scale_up_required";

export interface ReasonedHypothesis {
  id: string;
  kind: HypothesisKind;
  target: string;
  confidence: number;          // 0..1
  signalIds: string[];
  reason: string;
  /** What the simulator + policy gate should evaluate next. */
  expectedNextAgents: ReadonlyArray<"simulator" | "policy_gate" | "boundary_gate" | "approver">;
}

const SIGNAL_TO_HYPOTHESIS: Record<SignalKind, HypothesisKind> = {
  drift:            "drift_remediation_needed",
  cost_anomaly:     "cost_breach_imminent",
  slo_burn:         "slo_burn_active",
  vuln_kev:         "exploit_window_open",
  policy_violation: "policy_drift_detected",
  saturation:       "scale_up_required",
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function weighted(values: readonly number[]): number {
  if (values.length === 0) return 0;
  // Simple geometric-ish mean: average penalized by missing signal count.
  let sum = 0;
  for (const v of values) sum += clamp01(v);
  return sum / values.length;
}

export function weaveHypotheses(signals: readonly DetectorSignal[]): ReasonedHypothesis[] {
  if (signals.length === 0) return [];

  // Group by (kind, target). One hypothesis per group.
  const groups = new Map<string, DetectorSignal[]>();
  for (const s of signals) {
    const key = `${s.kind}::${s.target}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }

  const out: ReasonedHypothesis[] = [];
  let idx = 0;
  for (const [key, arr] of groups) {
    const kind = arr[0].kind;
    const confidence = weighted(arr.map((s) => s.confidence));
    const hKind = SIGNAL_TO_HYPOTHESIS[kind];
    const target = arr[0].target;
    const reason = `${arr.length} ${kind} signal(s) on ${target}: ${arr.map((s) => s.evidence.slice(0, 80)).join(" | ")}`;
    const expectedNextAgents = nextAgentsFor(hKind);
    idx += 1;
    out.push({
      id: `hyp-${idx}`,
      kind: hKind,
      target,
      confidence: Math.round(confidence * 100) / 100,
      signalIds: arr.map((s) => s.id),
      reason: reason.slice(0, 600),
      expectedNextAgents,
    });
  }

  // Sort by confidence desc so the cockpit shows the strongest first.
  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}

function nextAgentsFor(h: HypothesisKind): ReasonedHypothesis["expectedNextAgents"] {
  switch (h) {
    case "drift_remediation_needed":
      return ["simulator", "policy_gate", "boundary_gate", "approver"];
    case "cost_breach_imminent":
      return ["policy_gate", "approver"];
    case "slo_burn_active":
      return ["simulator", "policy_gate", "approver"];
    case "exploit_window_open":
      return ["policy_gate", "boundary_gate", "approver"];
    case "policy_drift_detected":
      return ["policy_gate", "approver"];
    case "scale_up_required":
      return ["simulator", "approver"];
  }
}
