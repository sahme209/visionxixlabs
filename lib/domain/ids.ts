/**
 * Canonical ID kinds used across the platform.
 *
 * Every entity Axiom reasons about has a typed ID. Branded string types prevent
 * accidental cross-wiring (e.g. passing an executionPlanId where a connectorId
 * is expected) without runtime overhead.
 *
 * These are the SINGLE source of truth — all other modules should import from
 * here rather than re-declaring `string` aliases.
 */

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

export type OrganizationId      = Brand<string, "OrganizationId">;
export type UserId              = Brand<string, "UserId">;
export type AccountId           = Brand<string, "AccountId">;             // AWS account / Azure sub / GCP project
export type ConnectorId         = Brand<string, "ConnectorId">;
export type ConnectorTenantId   = Brand<string, "ConnectorTenantId">;     // (organizationId, connectorId) pair
export type SnapshotId          = Brand<string, "SnapshotId">;
export type ResourceId          = Brand<string, "ResourceId">;
export type FindingId           = Brand<string, "FindingId">;
export type RecommendationId    = Brand<string, "RecommendationId">;
export type ExecutionPlanId     = Brand<string, "ExecutionPlanId">;
export type ExecutionRunId      = Brand<string, "ExecutionRunId">;
export type ApprovalId          = Brand<string, "ApprovalId">;
export type AuditEventId        = Brand<string, "AuditEventId">;
export type MemoryRecordId      = Brand<string, "MemoryRecordId">;
export type WorkflowId          = Brand<string, "WorkflowId">;
export type WorkflowRunId       = Brand<string, "WorkflowRunId">;
export type JobId               = Brand<string, "JobId">;
export type PolicyRuleId        = Brand<string, "PolicyRuleId">;
export type ReleaseId           = Brand<string, "ReleaseId">;
export type GraphNodeId         = Brand<string, "GraphNodeId">;
export type GraphEdgeId         = Brand<string, "GraphEdgeId">;
export type CorrelationId       = Brand<string, "CorrelationId">;
export type CausationId         = Brand<string, "CausationId">;
export type TraceId             = Brand<string, "TraceId">;
export type SpanId              = Brand<string, "SpanId">;
export type IdempotencyKey      = Brand<string, "IdempotencyKey">;

/** Construct a typed ID from a raw string. Use sparingly — at boundaries only. */
export const id = {
  organization: (s: string) => s as OrganizationId,
  user:         (s: string) => s as UserId,
  account:      (s: string) => s as AccountId,
  connector:    (s: string) => s as ConnectorId,
  connectorTenant: (s: string) => s as ConnectorTenantId,
  snapshot:     (s: string) => s as SnapshotId,
  resource:     (s: string) => s as ResourceId,
  finding:      (s: string) => s as FindingId,
  recommendation: (s: string) => s as RecommendationId,
  executionPlan: (s: string) => s as ExecutionPlanId,
  executionRun:  (s: string) => s as ExecutionRunId,
  approval:     (s: string) => s as ApprovalId,
  auditEvent:   (s: string) => s as AuditEventId,
  memoryRecord: (s: string) => s as MemoryRecordId,
  workflow:     (s: string) => s as WorkflowId,
  workflowRun:  (s: string) => s as WorkflowRunId,
  job:          (s: string) => s as JobId,
  policyRule:   (s: string) => s as PolicyRuleId,
  release:      (s: string) => s as ReleaseId,
  graphNode:    (s: string) => s as GraphNodeId,
  graphEdge:    (s: string) => s as GraphEdgeId,
  correlation:  (s: string) => s as CorrelationId,
  causation:    (s: string) => s as CausationId,
  trace:        (s: string) => s as TraceId,
  span:         (s: string) => s as SpanId,
  idempotency:  (s: string) => s as IdempotencyKey,
} as const;

/**
 * Generate a new correlation ID. Format: `corr_<timeMillis>_<rand>`.
 * Deterministic enough for logs, random enough to never collide in practice.
 */
export function newCorrelationId(): CorrelationId {
  const rand = Math.random().toString(36).slice(2, 10);
  return `corr_${Date.now().toString(36)}_${rand}` as CorrelationId;
}

export function newTraceId(): TraceId {
  const rand = Math.random().toString(36).slice(2, 14);
  return `trace_${Date.now().toString(36)}_${rand}` as TraceId;
}

export function newSpanId(): SpanId {
  const rand = Math.random().toString(36).slice(2, 10);
  return `span_${rand}` as SpanId;
}
