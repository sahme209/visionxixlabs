/**
 * Operation tracing — typed, pure-function spans for multi-step Axiom
 * actions. Captures the chain of work that turned an intent ("scan AWS")
 * into outcomes ("snapshot.created + 3 findings") so the UI, audit log,
 * and copilot can reconstruct *why*.
 *
 * Not a replacement for OpenTelemetry — it's the operational decision
 * trace, persisted alongside the execution plan and surfaced in the UI.
 */

import { newSpanId, newTraceId } from "@/lib/domain/ids";
import type { CorrelationId, OrganizationId, SpanId, TraceId } from "@/lib/domain/ids";

export type SpanStatus = "ok" | "error" | "cancelled";

export interface OperationSpan {
  spanId: SpanId;
  parentSpanId?: SpanId;
  name: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  status: SpanStatus;
  attributes: Record<string, string | number | boolean>;
  /** Short reason string when status !== "ok". */
  errorCode?: string;
}

export interface OperationTrace {
  traceId: TraceId;
  organizationId: OrganizationId;
  correlationId: CorrelationId;
  rootSpanName: string;
  startedAt: string;
  endedAt?: string;
  spans: OperationSpan[];
}

export interface OperationTraceInit {
  organizationId: OrganizationId;
  correlationId: CorrelationId;
  rootSpanName: string;
}

/** Build a new trace with an open root span. */
export function startTrace(init: OperationTraceInit): { trace: OperationTrace; rootSpanId: SpanId } {
  const traceId = newTraceId();
  const rootSpanId = newSpanId();
  const now = new Date().toISOString();
  const trace: OperationTrace = {
    traceId,
    organizationId: init.organizationId,
    correlationId: init.correlationId,
    rootSpanName: init.rootSpanName,
    startedAt: now,
    spans: [
      {
        spanId: rootSpanId,
        name: init.rootSpanName,
        startedAt: now,
        status: "ok",
        attributes: {},
      },
    ],
  };
  return { trace, rootSpanId };
}

/** Append a child span. Returns a new trace (immutable update). */
export function openSpan(
  trace: OperationTrace,
  name: string,
  parentSpanId: SpanId,
  attributes: Record<string, string | number | boolean> = {}
): { trace: OperationTrace; spanId: SpanId } {
  const spanId = newSpanId();
  const span: OperationSpan = {
    spanId,
    parentSpanId,
    name,
    startedAt: new Date().toISOString(),
    status: "ok",
    attributes,
  };
  return { trace: { ...trace, spans: [...trace.spans, span] }, spanId };
}

/** Close a span — fill `endedAt`, `durationMs`, `status`, `errorCode`. */
export function closeSpan(
  trace: OperationTrace,
  spanId: SpanId,
  outcome: { status: SpanStatus; errorCode?: string; attributes?: Record<string, string | number | boolean> } = { status: "ok" }
): OperationTrace {
  const now = new Date();
  const nowIso = now.toISOString();
  return {
    ...trace,
    spans: trace.spans.map((s) => {
      if (s.spanId !== spanId) return s;
      const startedMs = new Date(s.startedAt).getTime();
      return {
        ...s,
        endedAt: nowIso,
        durationMs: Math.max(0, now.getTime() - startedMs),
        status: outcome.status,
        errorCode: outcome.errorCode,
        attributes: { ...s.attributes, ...(outcome.attributes ?? {}) },
      };
    }),
  };
}

/** Close the trace. Open spans are auto-closed as "cancelled". */
export function endTrace(trace: OperationTrace): OperationTrace {
  const now = new Date();
  const nowIso = now.toISOString();
  return {
    ...trace,
    endedAt: nowIso,
    spans: trace.spans.map((s) => {
      if (s.endedAt) return s;
      const startedMs = new Date(s.startedAt).getTime();
      return {
        ...s,
        endedAt: nowIso,
        durationMs: Math.max(0, now.getTime() - startedMs),
        status: "cancelled",
      };
    }),
  };
}

/** Roll up summary stats for UI rendering. */
export interface TraceSummary {
  totalDurationMs: number;
  spanCount: number;
  errorCount: number;
  longestSpan?: { name: string; durationMs: number };
}

export function summarizeTrace(trace: OperationTrace): TraceSummary {
  let totalDurationMs = 0;
  let errorCount = 0;
  let longest: { name: string; durationMs: number } | undefined;
  for (const s of trace.spans) {
    const d = s.durationMs ?? 0;
    if (!s.parentSpanId) totalDurationMs = d;
    if (s.status === "error") errorCount++;
    if (!longest || d > longest.durationMs) longest = { name: s.name, durationMs: d };
  }
  return { totalDurationMs, spanCount: trace.spans.length, errorCount, longestSpan: longest };
}
