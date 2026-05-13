/**
 * Memory timeline adapter — converts MemoryRecord[] into the day-grouped
 * shape consumed by the MemoryTimeline component.
 *
 * Pure mapping function. No I/O.
 */

import type { MemoryRecord, MemoryRecordKind } from "@/lib/memory/operationalMemory";

// ---------------------------------------------------------------------------
// Output types — mirror the component shape
// ---------------------------------------------------------------------------

export type TimelineEventKind =
  | "scan"
  | "recommendation.accepted"
  | "recommendation.ignored"
  | "execution.applied"
  | "execution.failed"
  | "drift.detected"
  | "rollback.executed"
  | "approval.granted"
  | "approval.denied"
  | "cost.shift"
  | "confidence.increase"
  | "confidence.decrease"
  | "baseline.snapshot";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  title: string;
  detail: string;
  timestamp: string;
  provider?: "aws" | "azure" | "gcp";
  outcome?: "positive" | "negative" | "neutral";
  delta?: { label: string; value: string; direction?: "up" | "down" };
}

export interface TimelineDayGroup {
  date: string;
  label: string;
  events: TimelineEvent[];
  summary: {
    scans: number;
    plans: number;
    savings: number;
    findings: number;
  };
}

// ---------------------------------------------------------------------------
// Kind mapping
// ---------------------------------------------------------------------------

function mapKind(kind: MemoryRecordKind): TimelineEventKind {
  switch (kind) {
    case "scan.completed":
    case "scan.failed":
      return "scan";
    case "recommendation.accepted":
      return "recommendation.accepted";
    case "recommendation.rejected":
    case "recommendation.deferred":
      return "recommendation.ignored";
    case "execution.applied":
      return "execution.applied";
    case "execution.failed":
      return "execution.failed";
    case "drift.detected":
      return "drift.detected";
    case "rollback.executed":
    case "rollback.failed":
      return "rollback.executed";
    case "approval.granted":
      return "approval.granted";
    case "approval.denied":
    case "approval.expired":
      return "approval.denied";
    default:
      return "baseline.snapshot";
  }
}

function mapProvider(p?: string): TimelineEvent["provider"] {
  if (p === "aws" || p === "azure" || p === "gcp") return p;
  return undefined;
}

function deriveDelta(record: MemoryRecord): TimelineEvent["delta"] | undefined {
  const { impact } = record;
  if (impact.costDeltaUsd != null && impact.costDeltaUsd !== 0) {
    const positive = impact.costDeltaUsd > 0;
    return {
      label: "Monthly cost shift",
      value: `${positive ? "+" : "-"}$${Math.abs(Math.round(impact.costDeltaUsd))}`,
      direction: positive ? "up" : "down",
    };
  }
  if (impact.confidenceDelta != null && impact.confidenceDelta !== 0) {
    const positive = impact.confidenceDelta > 0;
    return {
      label: "Confidence",
      value: `${positive ? "+" : ""}${Math.round(impact.confidenceDelta * 100)} pts`,
      direction: positive ? "up" : "down",
    };
  }
  if (impact.riskDelta && impact.riskDelta !== "unchanged") {
    return {
      label: "Risk",
      value: impact.riskDelta,
      direction: impact.riskDelta === "decreased" ? "down" : "up",
    };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

export function recordToEvent(record: MemoryRecord): TimelineEvent {
  return {
    id: record.id,
    kind: mapKind(record.kind),
    title: record.summary,
    detail: record.evidence.map((e) => `${e.name}: ${e.value}`).join(" · ") || record.summary,
    timestamp: record.occurredAt,
    provider: mapProvider(record.provider),
    outcome: record.outcome === "pending" ? "neutral" : record.outcome,
    delta: deriveDelta(record),
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const key = dayKey(d);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Convert a flat MemoryRecord[] into the day-grouped TimelineDayGroup[] shape
 * consumed by the MemoryTimeline component. Newest day first.
 */
export function recordsToTimeline(records: MemoryRecord[]): TimelineDayGroup[] {
  const byDay = new Map<string, MemoryRecord[]>();
  for (const r of records) {
    const k = dayKey(new Date(r.occurredAt));
    const list = byDay.get(k) ?? [];
    list.push(r);
    byDay.set(k, list);
  }

  const groups: TimelineDayGroup[] = [];
  for (const [date, dayRecords] of Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]))) {
    const events = dayRecords.map(recordToEvent).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const scans = dayRecords.filter((r) => r.kind === "scan.completed" || r.kind === "scan.failed").length;
    const plans = dayRecords.filter((r) => r.kind === "execution.applied").length;
    const savings = dayRecords.reduce((s, r) => s + (r.impact.costDeltaUsd && r.impact.costDeltaUsd > 0 ? r.impact.costDeltaUsd : 0), 0);
    const findings = dayRecords.filter((r) => r.kind === "finding.observed" || r.kind === "finding.recurring" || r.kind === "drift.detected").length;
    groups.push({ date, label: dayLabel(date), events, summary: { scans, plans, savings: Math.round(savings), findings } });
  }
  return groups;
}
