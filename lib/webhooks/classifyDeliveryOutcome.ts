/**
 * Pure delivery-outcome classifier — Phase 395.
 *
 * Given the result of an HTTP attempt against an integrator endpoint,
 * decide what kind of outcome it is. Closed-union so the persistence
 * layer can render specific badges + the retry scheduler can branch
 * on a small, exhaustive set of cases.
 *
 * Why this exists separately from computeWebhookRetry:
 *   - classification is "what kind of failure" (e.g. 4xx ≠ 5xx ≠ network)
 *   - scheduling is "given a retryable failure, when next?"
 *   Splitting them keeps each kernel testable in isolation and lets a
 *   future provider (e.g. workspace-disabled deadletter) extend the
 *   classifier without touching the scheduler.
 *
 * Pure — no I/O.
 */

export type DeliveryOutcomeKind =
  | "delivered"
  | "retry_due_to_5xx"
  | "retry_due_to_network"
  | "retry_due_to_timeout"
  | "deadletter_4xx"             // 4xx means the endpoint REJECTED us; no retry
  | "deadletter_invalid_url"     // pre-flight URL validation failure
  | "deadletter_endpoint_disabled"; // endpoint was revoked between enqueue + send

export interface ClassifyInput {
  /** HTTP status returned by the integrator, or null on network failure. */
  httpStatus: number | null;
  /** Set when fetch failed before getting a response. */
  networkError?: string | null;
  /** True when the request hit our client-side timeout. */
  timedOut?: boolean;
  /** Set when pre-flight checks rejected the URL (e.g. wrong protocol). */
  invalidUrl?: boolean;
  /** True when the endpoint row's revokedAt is set. */
  endpointDisabled?: boolean;
}

export interface DeliveryOutcome {
  kind: DeliveryOutcomeKind;
  /** True when the caller should attempt to retry (subject to MAX_ATTEMPTS). */
  retryable: boolean;
  message: string;
}

export function classifyDeliveryOutcome(input: ClassifyInput): DeliveryOutcome {
  if (input.endpointDisabled) {
    return {
      kind: "deadletter_endpoint_disabled",
      retryable: false,
      message: "Endpoint is revoked; will not deliver.",
    };
  }
  if (input.invalidUrl) {
    return {
      kind: "deadletter_invalid_url",
      retryable: false,
      message: "Endpoint URL failed pre-flight validation.",
    };
  }
  if (input.timedOut) {
    return {
      kind: "retry_due_to_timeout",
      retryable: true,
      message: "Delivery attempt timed out.",
    };
  }
  if (input.networkError) {
    return {
      kind: "retry_due_to_network",
      retryable: true,
      message: `Network error: ${input.networkError}`,
    };
  }

  // At this point httpStatus must be set.
  const status = input.httpStatus;
  if (status === null || status === undefined) {
    return {
      kind: "retry_due_to_network",
      retryable: true,
      message: "No HTTP status returned (treated as network failure).",
    };
  }

  if (status >= 200 && status < 300) {
    return {
      kind: "delivered",
      retryable: false,
      message: `Endpoint accepted with ${status}.`,
    };
  }

  if (status >= 500 && status < 600) {
    return {
      kind: "retry_due_to_5xx",
      retryable: true,
      message: `Endpoint returned ${status}; will retry.`,
    };
  }

  // Any other 3xx / 4xx (including 408, 429) — we count as deadletter
  // since the endpoint is explicitly telling us not to deliver.
  // 429 specifically is a deadletter because the operator should fix
  // their rate limit, not have us silently buffer.
  return {
    kind: "deadletter_4xx",
    retryable: false,
    message: `Endpoint returned ${status}; will not retry.`,
  };
}
