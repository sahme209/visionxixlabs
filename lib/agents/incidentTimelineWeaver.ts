/**
 * Pure incident timeline weaver.
 *
 * Input: a heterogeneous stream of events related to an incident —
 * alert fires, audit rows, bus messages, deployments, operator
 * actions. Output: a typed, time-ordered IncidentTimeline with
 * detection / mitigation / recovery markers + a duration breakdown.
 *
 * Pure / deterministic. Closed unions on event kind + phase so future
 * shapes break the build.
 *
 * Downstream the postmortemDrafter consumes this timeline to render
 * the canonical post-incident write-up.
 */

export type IncidentEventKind =
  | "alert_fired"
  | "operator_acknowledged"
  | "deploy_started"
  | "deploy_finished"
  | "automation_run"
  | "audit_action"
  | "bus_message"
  | "operator_action"
  | "rollback_initiated"
  | "service_recovered";

export type IncidentPhase =
  | "before_detection"
  | "detection"
  | "investigation"
  | "mitigation"
  | "recovery"
  | "after_recovery";

export interface IncidentEvent {
  id: string;
  /** When the event occurred (ISO). */
  at: string;
  kind: IncidentEventKind;
  /** Free-form actor — agent module, operator email, or system. */
  actor: string;
  /** Operator-readable description (single line). */
  description: string;
  /** Optional reference id — audit row id, run id, etc. */
  ref?: string;
}

export interface TimelineMarkers {
  /** First alert_fired event time, ISO. */
  detectionAt: string | null;
  /** First operator_acknowledged event time, ISO. */
  acknowledgedAt: string | null;
  /** First rollback_initiated / mitigation action time, ISO. */
  mitigationStartedAt: string | null;
  /** First service_recovered event time, ISO. */
  recoveredAt: string | null;
}

export interface TimelineDurations {
  /** Time-to-detect — first telemetry signal to operator ack. */
  ttdMinutes: number | null;
  /** Time-to-mitigate — ack to first mitigation action. */
  ttmMinutes: number | null;
  /** Time-to-recover — first mitigation to service_recovered. */
  ttrMinutes: number | null;
  /** Total outage — first alert to recovery. */
  totalOutageMinutes: number | null;
}

export interface IncidentEventWithPhase extends IncidentEvent {
  phase: IncidentPhase;
}

export interface IncidentTimeline {
  events: readonly IncidentEventWithPhase[];
  markers: TimelineMarkers;
  durations: TimelineDurations;
  /** True when at least one of: rollback, deploy, or automation event exists. */
  hadActionableEvents: boolean;
  /** Closed-union final state of the incident as evidenced by events. */
  finalState: "recovered" | "ongoing" | "no_signal";
}

const MS_PER_MIN = 60_000;

function diffMin(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / MS_PER_MIN;
}

function isMitigationKind(k: IncidentEventKind): boolean {
  return k === "rollback_initiated" || k === "automation_run" || k === "operator_action";
}

export function weaveTimeline(events: readonly IncidentEvent[]): IncidentTimeline {
  if (events.length === 0) {
    return {
      events: [],
      markers: { detectionAt: null, acknowledgedAt: null, mitigationStartedAt: null, recoveredAt: null },
      durations: { ttdMinutes: null, ttmMinutes: null, ttrMinutes: null, totalOutageMinutes: null },
      hadActionableEvents: false,
      finalState: "no_signal",
    };
  }

  // Sort by `at` ascending — events MAY arrive out-of-order.
  const sorted = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  // Identify markers.
  const detection = sorted.find((e) => e.kind === "alert_fired") ?? null;
  const ack = sorted.find((e) => e.kind === "operator_acknowledged") ?? null;
  const mitigation = sorted.find((e) => isMitigationKind(e.kind)) ?? null;
  const recovery = sorted.find((e) => e.kind === "service_recovered") ?? null;

  const markers: TimelineMarkers = {
    detectionAt: detection?.at ?? null,
    acknowledgedAt: ack?.at ?? null,
    mitigationStartedAt: mitigation?.at ?? null,
    recoveredAt: recovery?.at ?? null,
  };

  const durations: TimelineDurations = {
    ttdMinutes:
      detection && ack ? round(diffMin(detection.at, ack.at)) : null,
    ttmMinutes:
      ack && mitigation ? round(diffMin(ack.at, mitigation.at)) : null,
    ttrMinutes:
      mitigation && recovery ? round(diffMin(mitigation.at, recovery.at)) : null,
    totalOutageMinutes:
      detection && recovery ? round(diffMin(detection.at, recovery.at)) : null,
  };

  // Phase-tag each event using marker thresholds.
  const phaseFor = (at: string): IncidentPhase => {
    const t = new Date(at).getTime();
    if (markers.detectionAt && t < new Date(markers.detectionAt).getTime()) return "before_detection";
    if (markers.acknowledgedAt && t < new Date(markers.acknowledgedAt).getTime()) return "detection";
    if (markers.mitigationStartedAt && t < new Date(markers.mitigationStartedAt).getTime()) return "investigation";
    if (markers.recoveredAt && t < new Date(markers.recoveredAt).getTime()) return "mitigation";
    if (markers.recoveredAt && t >= new Date(markers.recoveredAt).getTime()) return "after_recovery";
    // No recovery yet — anything after mitigation start is still mitigation.
    return markers.mitigationStartedAt ? "mitigation" : "investigation";
  };

  const tagged: IncidentEventWithPhase[] = sorted.map((e) => ({ ...e, phase: phaseFor(e.at) }));

  const hadActionableEvents = tagged.some(
    (e) => e.kind === "rollback_initiated" || e.kind === "deploy_started" || e.kind === "automation_run",
  );

  const finalState: IncidentTimeline["finalState"] = recovery
    ? "recovered"
    : detection
      ? "ongoing"
      : "no_signal";

  return { events: tagged, markers, durations, hadActionableEvents, finalState };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Convenience: render the timeline as a compact markdown bullet list. */
export function renderTimelineMarkdown(timeline: IncidentTimeline): string {
  if (timeline.events.length === 0) return "_No events recorded._";
  const lines: string[] = [];
  let lastPhase: IncidentPhase | null = null;
  for (const e of timeline.events) {
    if (e.phase !== lastPhase) {
      lines.push(`\n### ${phaseTitle(e.phase)}`);
      lastPhase = e.phase;
    }
    lines.push(`- \`${e.at}\` — **${e.actor}** · ${e.description}`);
  }
  return lines.join("\n").trim();
}

function phaseTitle(p: IncidentPhase): string {
  switch (p) {
    case "before_detection": return "Before detection";
    case "detection":        return "Detection";
    case "investigation":    return "Investigation";
    case "mitigation":       return "Mitigation";
    case "recovery":         return "Recovery";
    case "after_recovery":   return "After recovery";
  }
}
