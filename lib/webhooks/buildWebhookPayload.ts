/**
 * Pure webhook-payload builder — Phase 395.
 *
 * Canonical JSON shape every outbound delivery follows. Versioned so
 * we can evolve the envelope without breaking integrator parsers.
 *
 * The signed payload is `<timestampSec>.<body>` — the integrator side
 * pairs with the existing `validateWebhookSignature` helper in
 * `lib/security/webhookSignatureValidator.ts`. This means an engineer
 * who already integrates with Stripe-style webhooks can copy that
 * verification path verbatim.
 *
 * Pure — deterministic JSON ordering by emitting fields in a fixed
 * order so the same input produces byte-identical output (otherwise
 * the HMAC would be unstable).
 */

import type { WebhookEventKind } from "./webhookEventKinds";

export const WEBHOOK_PAYLOAD_VERSION = "v1";

export interface WebhookEnvelope {
  /** Schema version. Bump if we change envelope shape. */
  version: string;
  /** Unique id for this delivery — used by integrators for dedup. */
  eventId: string;
  /** Closed-union event kind. */
  type: WebhookEventKind;
  /** Wall-clock when the producer fired the event (seconds since epoch). */
  timestampSec: number;
  /** Workspace this event belongs to. Integrators MUST scope on this. */
  organizationId: string;
  /** Closed-union event-specific payload. */
  data: Record<string, unknown>;
  /** Echoes the attempt number — useful for the integrator to dedup retries. */
  attemptNumber: number;
}

export interface BuildPayloadInput {
  eventId: string;
  type: WebhookEventKind;
  organizationId: string;
  data: Record<string, unknown>;
  attemptNumber: number;
  /** Unix-seconds; pass for determinism + audit replay. */
  timestampSec: number;
}

/**
 * Build the canonical envelope object. The caller can pass this to
 * JSON.stringify to get the signed body — but use `serializeEnvelope`
 * for guaranteed byte-stability across attempts.
 */
export function buildWebhookEnvelope(input: BuildPayloadInput): WebhookEnvelope {
  return {
    version: WEBHOOK_PAYLOAD_VERSION,
    eventId: input.eventId,
    type: input.type,
    timestampSec: input.timestampSec,
    organizationId: input.organizationId,
    data: input.data,
    attemptNumber: input.attemptNumber,
  };
}

/**
 * Serialize the envelope to a canonical string. Key order is fixed
 * by the literal property declaration order above — V8 + node:json
 * preserve insertion order, so the same envelope object always
 * stringifies to the same bytes.
 *
 * This is the EXACT string that gets HMAC-signed. The integrator's
 * verifier must use the same string verbatim.
 */
export function serializeEnvelope(envelope: WebhookEnvelope): string {
  return JSON.stringify(envelope);
}

/**
 * Compose the standard headers a webhook delivery sends. Pulled out
 * so the cron retry path uses the same headers as the first delivery.
 */
export function buildWebhookHeaders(args: {
  signatureHex: string;
  timestampSec: number;
  eventId: string;
  eventKind: WebhookEventKind;
  attemptNumber: number;
}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "VisionXIXLabs-Webhooks/1.0",
    "X-VXL-Event-Id": args.eventId,
    "X-VXL-Event-Type": args.eventKind,
    "X-VXL-Timestamp": String(args.timestampSec),
    "X-VXL-Signature": args.signatureHex,
    "X-VXL-Attempt": String(args.attemptNumber),
  };
}
