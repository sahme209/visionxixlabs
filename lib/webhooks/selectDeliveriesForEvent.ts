/**
 * Pure delivery-selection kernel — Phase 395.
 *
 * Given an event (kind + organizationId) and the full set of an
 * organization's webhook endpoints, return the subset that should
 * receive this event. Used by the fan-out producer.
 *
 * The actual Prisma lookup lives at the I/O boundary
 * (`dispatchWebhookEvent.ts`); this kernel handles the matching logic
 * so the lookup is a single SELECT and the rest stays test-isolated.
 *
 * Pure / no I/O.
 */

import type { WebhookEventKind } from "./webhookEventKinds";
import { endpointSubscribesTo } from "./webhookEventKinds";

export interface WebhookEndpointSelection {
  id: string;
  url: string;
  subscribedEvents: ReadonlyArray<string>;
  revokedAt: Date | null;
  /** Optional caller-supplied "is this endpoint healthy" hint. */
  consecutiveFailures?: number;
  /** Max consecutive failures before the endpoint auto-disables. */
  autoDisableThreshold?: number;
}

export type SkipReason =
  | "revoked"
  | "unsubscribed_event"
  | "auto_disabled_too_many_failures";

export interface SelectionResult {
  toDeliver: ReadonlyArray<{ id: string; url: string }>;
  skipped: ReadonlyArray<{ id: string; url: string; reason: SkipReason }>;
}

export function selectDeliveriesForEvent(args: {
  endpoints: ReadonlyArray<WebhookEndpointSelection>;
  eventKind: WebhookEventKind;
}): SelectionResult {
  const toDeliver: { id: string; url: string }[] = [];
  const skipped: { id: string; url: string; reason: SkipReason }[] = [];

  for (const ep of args.endpoints) {
    if (ep.revokedAt !== null) {
      skipped.push({ id: ep.id, url: ep.url, reason: "revoked" });
      continue;
    }
    if (!endpointSubscribesTo(ep.subscribedEvents, args.eventKind)) {
      skipped.push({ id: ep.id, url: ep.url, reason: "unsubscribed_event" });
      continue;
    }
    if (
      typeof ep.autoDisableThreshold === "number" &&
      typeof ep.consecutiveFailures === "number" &&
      ep.consecutiveFailures >= ep.autoDisableThreshold
    ) {
      skipped.push({ id: ep.id, url: ep.url, reason: "auto_disabled_too_many_failures" });
      continue;
    }
    toDeliver.push({ id: ep.id, url: ep.url });
  }

  return { toDeliver, skipped };
}

/**
 * Pre-flight URL validation: only http(s), no localhost / private IPs
 * unless explicitly allowed. Pure — returns the validation reason
 * without making any network calls.
 */
export type UrlValidationFailure =
  | "wrong_protocol"
  | "private_ip_blocked"
  | "localhost_blocked"
  | "url_unparseable";

export interface UrlValidationResult {
  ok: boolean;
  reason?: UrlValidationFailure;
}

const PRIVATE_RANGES: ReadonlyArray<RegExp> = [
  /^10\./,                                    // 10.0.0.0/8
  /^192\.168\./,                              // 192.168.0.0/16
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,           // 172.16.0.0/12
  /^169\.254\./,                              // link-local
  /^fc[0-9a-f]{2}::/i,                        // IPv6 ULA
  /^fe80:/i,                                  // IPv6 link-local
];

const LOCALHOST_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "::1",
]);

export function validateWebhookUrl(
  raw: string,
  options: { allowPrivate?: boolean; allowHttp?: boolean } = {},
): UrlValidationResult {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "url_unparseable" };
  }

  if (u.protocol !== "https:" && !(options.allowHttp && u.protocol === "http:")) {
    return { ok: false, reason: "wrong_protocol" };
  }

  if (!options.allowPrivate) {
    const host = u.hostname.toLowerCase();
    if (LOCALHOST_HOSTNAMES.has(host)) {
      return { ok: false, reason: "localhost_blocked" };
    }
    if (PRIVATE_RANGES.some((re) => re.test(host))) {
      return { ok: false, reason: "private_ip_blocked" };
    }
  }

  return { ok: true };
}
