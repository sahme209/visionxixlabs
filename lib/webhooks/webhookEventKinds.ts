/**
 * Webhook event-kind closed-union — Phase 395.
 *
 * The canonical list of events VisionXIXLabs delivers to integrator
 * endpoints. Anything not in this union cannot be dispatched — the
 * `WebhookEndpoint.subscribedEvents` column is validated against this
 * set at registration time so a typo can't silently never-fire.
 *
 * Adding a new event:
 *   1. Add the kind here.
 *   2. Add the payload shape under WebhookEventPayloads.
 *   3. Call `dispatchWebhookEvent({ kind, ... })` from the producer.
 *
 * Pure / no I/O.
 */

export type WebhookEventKind =
  // Quality + release
  | "release_gate.passed"
  | "release_gate.blocked"
  | "eval.regression_detected"
  | "eval.run_completed"
  // Pipeline lifecycle
  | "pipeline.run_started"
  | "pipeline.run_completed"
  | "pipeline.run_failed"
  | "pipeline.stage_failed"
  | "pipeline.stage_decision_recorded"
  // PR / Coding loop
  | "coding.pr_opened"
  | "coding.lint_failed"
  | "coding.test_failed"
  // API key lifecycle
  | "api_key.created"
  | "api_key.revoked"
  // Billing + entitlements
  | "billing.threshold_crossed"
  | "billing.quota_exhausted";

const ALL_KINDS: ReadonlySet<string> = new Set<WebhookEventKind>([
  "release_gate.passed",
  "release_gate.blocked",
  "eval.regression_detected",
  "eval.run_completed",
  "pipeline.run_started",
  "pipeline.run_completed",
  "pipeline.run_failed",
  "pipeline.stage_failed",
  "pipeline.stage_decision_recorded",
  "coding.pr_opened",
  "coding.lint_failed",
  "coding.test_failed",
  "api_key.created",
  "api_key.revoked",
  "billing.threshold_crossed",
  "billing.quota_exhausted",
]);

/** True when `s` is a recognized event kind. */
export function isWebhookEventKind(s: string): s is WebhookEventKind {
  return ALL_KINDS.has(s);
}

/**
 * Filter + narrow an unknown array of strings to typed event kinds.
 * Unknown entries are dropped, so the caller can persist the return
 * value as the canonical subscribedEvents list with no stale-typo risk.
 */
export function normalizeEventKinds(input: ReadonlyArray<unknown>): WebhookEventKind[] {
  const out: WebhookEventKind[] = [];
  const seen = new Set<WebhookEventKind>();
  for (const s of input) {
    if (typeof s === "string" && isWebhookEventKind(s) && !seen.has(s)) {
      out.push(s);
      seen.add(s);
    }
  }
  return out;
}

/**
 * Does the endpoint care about this event kind?
 *
 * `subscribedEvents` may contain either specific kinds or a single "*"
 * meaning "every event." Wildcard is intentionally NOT a closed-union
 * member — it's only valid in the subscription list, never as a real
 * event kind dispatched by the platform.
 */
export function endpointSubscribesTo(
  subscribedEvents: ReadonlyArray<string>,
  eventKind: WebhookEventKind,
): boolean {
  if (subscribedEvents.includes("*")) return true;
  return subscribedEvents.includes(eventKind);
}
