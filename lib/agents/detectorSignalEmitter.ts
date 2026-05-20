/**
 * Pure detector-agent signal emitter.
 *
 * The detector agent inspects raw inventory + telemetry deltas +
 * compliance findings and emits typed DetectorSignals that the
 * reasoner consumes. This module is the deterministic emit rule —
 * downstream tests can verify the same input always produces the
 * same signal stream.
 *
 * Pure / deterministic. No DB / network.
 */

import type { DetectorSignal, SignalKind } from "./reasonerHypothesisWeaver";

export interface DetectorInputs {
  /** Drift findings (caller has already ran detectDrift). */
  drift?: ReadonlyArray<{ id: string; target: string; severity: "ok" | "low" | "medium" | "high"; reason: string }>;
  /** Cost anomaly rows. */
  cost?: ReadonlyArray<{ id: string; service: string; deltaUsd: number; deltaPct: number }>;
  /** SLO burn rows. */
  sloBurn?: ReadonlyArray<{ id: string; service: string; burnRate: number; verdict: "ok" | "burning_fast" | "exhausted" }>;
  /** KEV correlations. */
  kev?: ReadonlyArray<{ id: string; cveId: string; affectedTarget: string; severity: "low" | "medium" | "high" | "critical" }>;
  /** Policy gate violations from a recent baseline diff. */
  policy?: ReadonlyArray<{ id: string; target: string; ruleId: string }>;
  /** Saturation hits (capacity). */
  saturation?: ReadonlyArray<{ id: string; service: string; observedPeak: number; targetPeak: number }>;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function severityToConfidence(s: "ok" | "low" | "medium" | "high" | "critical"): number {
  switch (s) {
    case "ok": return 0;
    case "low": return 0.3;
    case "medium": return 0.55;
    case "high": return 0.8;
    case "critical": return 0.95;
  }
}

export function emitDetectorSignals(input: DetectorInputs): DetectorSignal[] {
  const signals: DetectorSignal[] = [];
  let idx = 0;
  const nextId = (kind: SignalKind): string => `sig-${kind}-${++idx}`;

  for (const d of input.drift ?? []) {
    if (d.severity === "ok") continue;
    signals.push({
      id: nextId("drift"),
      kind: "drift",
      target: d.target,
      confidence: severityToConfidence(d.severity),
      evidence: d.reason.slice(0, 200),
    });
  }

  for (const c of input.cost ?? []) {
    if (c.deltaUsd <= 0 && c.deltaPct <= 0) continue;
    // Confidence scales with deltaPct, capped at 1.
    signals.push({
      id: nextId("cost_anomaly"),
      kind: "cost_anomaly",
      target: c.service,
      confidence: clamp01(c.deltaPct / 100),
      evidence: `delta $${c.deltaUsd.toFixed(2)} / ${c.deltaPct.toFixed(0)}% on ${c.service}`,
    });
  }

  for (const s of input.sloBurn ?? []) {
    if (s.verdict === "ok") continue;
    signals.push({
      id: nextId("slo_burn"),
      kind: "slo_burn",
      target: s.service,
      confidence: clamp01(Math.min(1, s.burnRate / 3)), // burnRate=3 → confidence 1
      evidence: `${s.verdict} on ${s.service} (burnRate=${s.burnRate.toFixed(2)})`,
    });
  }

  for (const k of input.kev ?? []) {
    signals.push({
      id: nextId("vuln_kev"),
      kind: "vuln_kev",
      target: k.affectedTarget,
      confidence: severityToConfidence(k.severity),
      evidence: `${k.cveId} on ${k.affectedTarget} (${k.severity})`,
    });
  }

  for (const p of input.policy ?? []) {
    signals.push({
      id: nextId("policy_violation"),
      kind: "policy_violation",
      target: p.target,
      confidence: 0.7,
      evidence: `policy rule ${p.ruleId} failed on ${p.target}`,
    });
  }

  for (const s of input.saturation ?? []) {
    if (s.observedPeak <= s.targetPeak) continue;
    signals.push({
      id: nextId("saturation"),
      kind: "saturation",
      target: s.service,
      confidence: clamp01((s.observedPeak - s.targetPeak) / Math.max(0.01, 1 - s.targetPeak)),
      evidence: `peak ${(s.observedPeak * 100).toFixed(0)}% > target ${(s.targetPeak * 100).toFixed(0)}% on ${s.service}`,
    });
  }

  // Stable order: higher confidence first.
  signals.sort((a, b) => b.confidence - a.confidence);
  return signals;
}
