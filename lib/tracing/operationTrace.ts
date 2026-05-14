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
import type {
  ApprovalId, AuditEventId, CausationId, CorrelationId, ExecutionPlanId, ExecutionRunId,
  JobId, MemoryRecordId, OrganizationId, PolicyRuleId, ResourceId, SpanId, TraceId, UserId,
  WorkflowId, WorkflowRunId,
} from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";
import type { ProviderId } from "@/lib/domain/provider";

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

/**
 * Cross-entity link bag — connects a trace to the workflow run, jobs,
 * audit records, policy decisions, approval, plan, memory records, and
 * resources it touched. Optional fields stay undefined when the trace
 * didn't involve that entity.
 *
 * The trace layer captures *spans*; the links layer captures *what
 * artifacts the spans produced*. The Audit Center and Trace Viewer join
 * on these links to render the full story.
 */
export interface OperationTraceLinks {
  causationId?: CausationId;
  userId?: UserId;
  provider?: ProviderId;
  workflowId?: WorkflowId;
  workflowRunId?: WorkflowRunId;
  jobIds?: JobId[];
  auditEventIds?: AuditEventId[];
  /** ids of operational events emitted while this trace ran */
  operationalEventIds?: string[];
  memoryRecordIds?: MemoryRecordId[];
  policyRuleIds?: PolicyRuleId[];
  approvalIds?: ApprovalId[];
  executionPlanIds?: ExecutionPlanId[];
  executionRunIds?: ExecutionRunId[];
  /** ids of resources observed/affected — e.g. snapshot resource ids */
  resourceIds?: ResourceId[];
}

/**
 * A piece of evidence the operation used to reach its outcome. Used by the
 * trace viewer + audit bundle + copilot "what evidence?" answer.
 */
export interface TraceEvidence {
  /** Stable id for deduping across spans. */
  id: string;
  /** Where this evidence came from. */
  kind: "snapshot" | "finding" | "policy_rule" | "memory" | "audit_event" | "external_doc" | "metric" | "reasoning";
  /** Human-readable label rendered in the UI. */
  label: string;
  /** Optional href into the platform (e.g. /dashboard/findings/123). */
  href?: string;
  /** Optional summary — already redacted. */
  summary?: string;
}

export interface OperationTrace {
  traceId: TraceId;
  organizationId: OrganizationId;
  correlationId: CorrelationId;
  /** What kind of operation this is — drives display + filtering. */
  operation: string;
  /** Source system that initiated the trace. */
  sourceSystem: "api" | "workflow" | "scheduler" | "desktop" | "copilot" | "system";
  rootSpanName: string;
  startedAt: string;
  endedAt?: string;
  spans: OperationSpan[];
  /** Cross-entity links — empty by default. */
  links: OperationTraceLinks;
  /** Evidence the operation referenced. */
  evidence: TraceEvidence[];
  /** Honest data source. */
  source: DataSource;
  /** Set when the root span has been redacted before storage. */
  redacted: boolean;
  /** Safe next action when this trace ended in failure. */
  safeNextAction?: { label: string; href: string };
  /** Summary error code if the root span failed. */
  errorCode?: string;
}

export interface OperationTraceInit {
  organizationId: OrganizationId;
  correlationId: CorrelationId;
  rootSpanName: string;
  /** Operation tag — e.g. "connector.connect" / "scan.cloud". */
  operation?: string;
  sourceSystem?: OperationTrace["sourceSystem"];
  source?: DataSource;
  links?: OperationTraceLinks;
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
    operation: init.operation ?? init.rootSpanName,
    sourceSystem: init.sourceSystem ?? "api",
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
    links: init.links ?? {},
    evidence: [],
    source: init.source ?? "live",
    redacted: false,
  };
  return { trace, rootSpanId };
}

/** Attach link entities to a trace — appends, does not overwrite. */
export function linkTrace(trace: OperationTrace, patch: Partial<OperationTraceLinks>): OperationTrace {
  const merged: OperationTraceLinks = { ...trace.links };
  const mergeArray = <T,>(a: T[] | undefined, b: T[] | undefined): T[] | undefined => {
    if (!a && !b) return undefined;
    const set = new Set([...(a ?? []), ...(b ?? [])]);
    return Array.from(set) as T[];
  };
  merged.causationId = patch.causationId ?? merged.causationId;
  merged.userId = patch.userId ?? merged.userId;
  merged.provider = patch.provider ?? merged.provider;
  merged.workflowId = patch.workflowId ?? merged.workflowId;
  merged.workflowRunId = patch.workflowRunId ?? merged.workflowRunId;
  merged.jobIds = mergeArray(merged.jobIds, patch.jobIds);
  merged.auditEventIds = mergeArray(merged.auditEventIds, patch.auditEventIds);
  merged.operationalEventIds = mergeArray(merged.operationalEventIds, patch.operationalEventIds);
  merged.memoryRecordIds = mergeArray(merged.memoryRecordIds, patch.memoryRecordIds);
  merged.policyRuleIds = mergeArray(merged.policyRuleIds, patch.policyRuleIds);
  merged.approvalIds = mergeArray(merged.approvalIds, patch.approvalIds);
  merged.executionPlanIds = mergeArray(merged.executionPlanIds, patch.executionPlanIds);
  merged.executionRunIds = mergeArray(merged.executionRunIds, patch.executionRunIds);
  merged.resourceIds = mergeArray(merged.resourceIds, patch.resourceIds);
  return { ...trace, links: merged };
}

/** Attach evidence references — deduped by id. */
export function attachEvidence(trace: OperationTrace, evidence: TraceEvidence | TraceEvidence[]): OperationTrace {
  const additions = Array.isArray(evidence) ? evidence : [evidence];
  const byId = new Map<string, TraceEvidence>();
  for (const e of trace.evidence) byId.set(e.id, e);
  for (const e of additions) byId.set(e.id, e);
  return { ...trace, evidence: Array.from(byId.values()) };
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
