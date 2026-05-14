/**
 * DTO mappers — uniform translation between internal domain objects and the
 * shapes Axiom exposes at the HTTP/JSON boundary.
 *
 * The pattern: never let internal records leak straight to the wire. Strip
 * branded IDs to plain strings, drop server-internal fields, and replace
 * `unknown`-valued bags with explicitly serialisable maps. This stops
 * accidental disclosure of credentials / cause stacks / cursor tokens.
 */

import type { AxiomError } from "@/lib/errors/axiomErrors";
import type { AxiomEvent } from "@/lib/events/eventTypes";
import type { OperationTrace, OperationSpan } from "@/lib/tracing/operationTrace";

// ---------------------------------------------------------------------------
// Error DTO
// ---------------------------------------------------------------------------

export interface ErrorDTO {
  code: string;
  category: string;
  userMessage: string;
  detail?: string;
  context?: Record<string, string | number | boolean>;
}

export function toErrorDTO(err: AxiomError): ErrorDTO {
  return {
    code: err.code,
    category: err.category,
    userMessage: err.userMessage,
    detail: err.detail,
    context: err.context
      ? Object.fromEntries(
          Object.entries(err.context).filter(([, v]) => v !== undefined) as [string, string | number | boolean][]
        )
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Event DTO
// ---------------------------------------------------------------------------

export interface EventDTO {
  id: string;
  kind: string;
  organizationId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  actor: { kind: "user"; userId: string } | { kind: "system"; component: string } | { kind: "external"; provider: string };
  source: string;
  /** Payload — kind-specific fields, with branded IDs stripped to strings. */
  payload: Record<string, string | number | boolean>;
}

export function toEventDTO(event: AxiomEvent): EventDTO {
  // Discriminated payload — strip the envelope, keep everything else
  const { id, kind, organizationId, occurredAt, correlationId, causationId, actor, source, ...rest } = event;
  return {
    id,
    kind,
    organizationId: organizationId as unknown as string,
    occurredAt,
    correlationId: correlationId as unknown as string,
    causationId: causationId as unknown as string | undefined,
    actor: actor as EventDTO["actor"],
    source,
    payload: Object.fromEntries(
      Object.entries(rest).filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    ) as Record<string, string | number | boolean>,
  };
}

// ---------------------------------------------------------------------------
// Trace DTO
// ---------------------------------------------------------------------------

export interface SpanDTO {
  spanId: string;
  parentSpanId?: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  status: OperationSpan["status"];
  errorCode?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface TraceDTO {
  traceId: string;
  organizationId: string;
  correlationId: string;
  rootSpanName: string;
  startedAt: string;
  endedAt?: string;
  spans: SpanDTO[];
}

export function toSpanDTO(s: OperationSpan): SpanDTO {
  return {
    spanId: s.spanId as unknown as string,
    parentSpanId: s.parentSpanId as unknown as string | undefined,
    name: s.name,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationMs: s.durationMs,
    status: s.status,
    errorCode: s.errorCode,
    attributes: s.attributes,
  };
}

export function toTraceDTO(t: OperationTrace): TraceDTO {
  return {
    traceId: t.traceId as unknown as string,
    organizationId: t.organizationId as unknown as string,
    correlationId: t.correlationId as unknown as string,
    rootSpanName: t.rootSpanName,
    startedAt: t.startedAt,
    endedAt: t.endedAt,
    spans: t.spans.map(toSpanDTO),
  };
}

// ---------------------------------------------------------------------------
// Standard envelope for HTTP responses
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: ErrorDTO;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function apiFailure(error: AxiomError): ApiFailure {
  return { ok: false, error: toErrorDTO(error) };
}
