/**
 * Critical telemetry → outbound dispatcher.
 *
 * Bridges the telemetry ingest layer (live alerts from CloudWatch /
 * Datadog / Sentry / Dynatrace / New Relic / Azure Monitor / Cloud
 * Monitoring) to the outbound notification lane (Slack / Teams /
 * generic webhook).
 *
 * Without this bridge, critical signals are visible in the dashboard
 * but never reach a pager. With it, the autonomy loop closes —
 * humans get a Slack/Teams ping the instant a critical signal lands,
 * deduped per-signal-id so re-firing doesn't spam.
 *
 * Hard rules:
 *   - Only dispatches signals at severity critical OR high.
 *   - Each signal is deduped by sourceProvider + signal id (10-minute
 *     window owned by the outbound lane).
 *   - Read-only — never modifies signal state.
 */

import "server-only";

import { sendOutboundNotification, type OutboundSendResult } from "./outboundNotificationLane";
import type { TelemetrySeverity, TelemetrySignal } from "@/lib/telemetry/telemetryIngestModel";

export interface DispatchOutcome {
  totalSignalsInspected: number;
  totalDispatchAttempted: number;
  totalDispatchSucceeded: number;
  perSignalResults: { signalId: string; provider: string; result: OutboundSendResult }[];
}

export async function dispatchCriticalTelemetry(opts: {
  tenantId: string;
  signals: TelemetrySignal[];
  minSeverity?: TelemetrySeverity;
}): Promise<DispatchOutcome> {
  const min = severityRank(opts.minSeverity ?? "high");
  const candidates = opts.signals.filter((s) => severityRank(s.severity) >= min);

  const results: DispatchOutcome["perSignalResults"] = [];
  let succeeded = 0;

  for (const sig of candidates) {
    const res = await sendOutboundNotification({
      dedupeKey: `telemetry:${sig.sourceProvider}:${sig.id}`,
      kind: "critical_telemetry_signal",
      severity: sig.severity === "info" || sig.severity === "low" ? "medium" : sig.severity,
      tenantId: opts.tenantId,
      headline: `[${sig.sourceProvider}] ${sig.headline}`,
      body: `*Scope:* ${sig.scope}\n*Fired:* ${sig.firedAt}\n*Confidence:* ${sig.confidence.toFixed(2)}\n\n${sig.detail}`,
      safeNextAction: sig.safeNextAction,
      evidenceRefs: [sig.evidenceRef],
    });
    results.push({ signalId: sig.id, provider: sig.sourceProvider, result: res });
    if (res.ok) succeeded++;
  }

  return {
    totalSignalsInspected: opts.signals.length,
    totalDispatchAttempted: candidates.length,
    totalDispatchSucceeded: succeeded,
    perSignalResults: results,
  };
}

function severityRank(s: TelemetrySeverity): number {
  switch (s) {
    case "critical": return 4;
    case "high":     return 3;
    case "medium":   return 2;
    case "low":      return 1;
    case "info":     return 0;
  }
}
