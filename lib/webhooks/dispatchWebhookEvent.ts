/**
 * Webhook event fan-out — Phase 395.
 *
 * Called by every event producer (release-gate evaluator, eval-run
 * completer, pipeline stage runner, ...) to enqueue deliveries for
 * all matching endpoints in a workspace.
 *
 * - Looks up the workspace's endpoints once.
 * - Runs the pure `selectDeliveriesForEvent` to filter.
 * - Enqueues one `WebhookDelivery` row per matched endpoint at
 *   attemptNumber=1, status="queued", attemptedAt=null.
 * - Optionally fires the first attempt synchronously (default) so a
 *   healthy endpoint sees the event within the same request.
 *
 * This function is ALWAYS best-effort wrapped at the call site —
 * a webhook outage must never block the upstream business event.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import {
  selectDeliveriesForEvent,
} from "./selectDeliveriesForEvent";
import { buildWebhookEnvelope } from "./buildWebhookPayload";
import type { WebhookEventKind } from "./webhookEventKinds";
import { deliverWebhookDelivery } from "./deliverWebhook";
import { randomBytes } from "node:crypto";

export interface DispatchEventInput {
  organizationId: string;
  eventKind: WebhookEventKind;
  /** Event-specific payload. */
  data: Record<string, unknown>;
  /** When true (default), the first attempt is sent inline. */
  fireImmediately?: boolean;
  /** Optional correlationId — defaults to a fresh id. */
  correlationId?: string;
}

export interface DispatchEventResult {
  eventId: string;
  enqueuedCount: number;
  skippedCount: number;
  immediateOutcomes: ReadonlyArray<{
    deliveryId: string;
    outcomeKind: string;
  }>;
}

function newEventId(): string {
  return `evt_${randomBytes(12).toString("base64url")}`;
}

export async function dispatchWebhookEvent(input: DispatchEventInput): Promise<DispatchEventResult> {
  const eventId = newEventId();
  const correlationId = input.correlationId ?? eventId;
  const timestampSec = Math.floor(Date.now() / 1000);

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId: input.organizationId },
    select: {
      id: true, url: true, subscribedEvents: true, revokedAt: true,
      consecutiveFailures: true, autoDisableThreshold: true,
    },
  });

  const normalized = endpoints.map((e) => ({
    id: e.id,
    url: e.url,
    subscribedEvents: Array.isArray(e.subscribedEvents) ? e.subscribedEvents as string[] : [],
    revokedAt: e.revokedAt,
    consecutiveFailures: e.consecutiveFailures,
    autoDisableThreshold: e.autoDisableThreshold,
  }));

  const selection = selectDeliveriesForEvent({
    endpoints: normalized,
    eventKind: input.eventKind,
  });

  if (selection.toDeliver.length === 0) {
    return { eventId, enqueuedCount: 0, skippedCount: selection.skipped.length, immediateOutcomes: [] };
  }

  // Persist + (optionally) fire each. We do these sequentially (not
  // Promise.all) because each delivery may schedule a retry row that
  // shouldn't race the parent row's status update.
  const immediate: { deliveryId: string; outcomeKind: string }[] = [];

  for (const ep of selection.toDeliver) {
    const envelope = buildWebhookEnvelope({
      eventId,
      type: input.eventKind,
      organizationId: input.organizationId,
      data: input.data,
      attemptNumber: 1,
      timestampSec,
    });

    const row = await prisma.webhookDelivery.create({
      data: {
        endpointId: ep.id,
        organizationId: input.organizationId,
        eventId,
        eventKind: input.eventKind,
        attemptNumber: 1,
        status: "queued",
        payload: envelope as unknown as object,
      },
      select: { id: true },
    });

    if (input.fireImmediately !== false) {
      const r = await deliverWebhookDelivery(row.id);
      if (r) immediate.push({ deliveryId: r.deliveryId, outcomeKind: r.outcomeKind });
    }
  }

  try {
    await recordAudit({
      organizationId: idFactory.organization(input.organizationId),
      actorKind: "system",
      action: "workforce.webhook_event_dispatched",
      outcome: "success",
      entityRef: `webhook_event:${eventId}`,
      correlationId: idFactory.correlation(correlationId),
      source: "live",
      detail: {
        eventKind: input.eventKind,
        enqueuedCount: selection.toDeliver.length,
        skippedCount: selection.skipped.length,
        skippedReasons: selection.skipped.map((s) => ({ id: s.id, reason: s.reason })),
      },
    });
  } catch { /* best-effort */ }

  return {
    eventId,
    enqueuedCount: selection.toDeliver.length,
    skippedCount: selection.skipped.length,
    immediateOutcomes: immediate,
  };
}
