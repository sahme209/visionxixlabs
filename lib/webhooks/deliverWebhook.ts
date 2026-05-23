/**
 * Webhook-delivery executor — Phase 395.
 *
 * Takes a queued `WebhookDelivery` row, performs the HTTP call against
 * the integrator endpoint, classifies the outcome, persists the
 * result, schedules a retry if applicable, and updates the parent
 * endpoint's `consecutiveFailures` counter.
 *
 * Two entry points:
 *   - deliverWebhookDelivery(deliveryId)  — single row, used by both
 *     the first-attempt fan-out and the retry-queue cron.
 *   - The pure kernels live in classifyDeliveryOutcome.ts +
 *     computeWebhookRetry.ts — all decision logic happens there.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { signWebhookPayload } from "@/lib/security/webhookSignatureValidator";
import { classifyDeliveryOutcome } from "./classifyDeliveryOutcome";
import { computeWebhookRetry } from "./computeWebhookRetry";
import { buildWebhookHeaders, serializeEnvelope, type WebhookEnvelope } from "./buildWebhookPayload";
import { validateWebhookUrl } from "./selectDeliveriesForEvent";
import { isWebhookEventKind } from "./webhookEventKinds";

const DELIVERY_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_MAX_BYTES = 2_048;

export interface DeliverResult {
  deliveryId: string;
  outcomeKind: string;
  retryable: boolean;
  nextAttemptAt: Date | null;
  /** True when we've now exhausted retries and deadlettered. */
  finalDeadletter: boolean;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number | null; bodySnippet: string | null; networkError: string | null; timedOut: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    let snippet: string | null = null;
    try {
      const text = await res.text();
      snippet = text.length > RESPONSE_BODY_MAX_BYTES
        ? text.slice(0, RESPONSE_BODY_MAX_BYTES) + "…[truncated]"
        : text;
    } catch { /* body read errors → null snippet */ }
    return { status: res.status, bodySnippet: snippet, networkError: null, timedOut: false };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      status: null,
      bodySnippet: null,
      networkError: aborted ? null : (err instanceof Error ? err.message : "unknown_fetch_error"),
      timedOut: aborted,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function deliverWebhookDelivery(deliveryId: string): Promise<DeliverResult | null> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      endpoint: {
        select: {
          id: true, url: true, secret: true, revokedAt: true,
          consecutiveFailures: true, autoDisableThreshold: true,
          organizationId: true,
        },
      },
    },
  });

  if (!delivery) return null;
  if (delivery.status === "delivered" || delivery.status === "deadletter") {
    return {
      deliveryId,
      outcomeKind: delivery.outcomeKind ?? "delivered",
      retryable: false,
      nextAttemptAt: null,
      finalDeadletter: delivery.status === "deadletter",
    };
  }

  const endpoint = delivery.endpoint;
  const envelope = delivery.payload as unknown as WebhookEnvelope;
  if (!envelope || typeof envelope !== "object" || !isWebhookEventKind(envelope.type)) {
    // Defensive: refuse to ship malformed envelopes (shouldn't happen
    // since dispatchWebhookEvent builds them, but treat as deadletter).
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "deadletter",
        outcomeKind: "deadletter_invalid_url",
        errorMessage: "Malformed envelope; refusing to deliver.",
      },
    });
    return {
      deliveryId,
      outcomeKind: "deadletter_invalid_url",
      retryable: false,
      nextAttemptAt: null,
      finalDeadletter: true,
    };
  }

  // Mark delivering — atomic CAS so the cron + manual paths don't race.
  const claim = await prisma.webhookDelivery.updateMany({
    where: { id: deliveryId, status: { in: ["queued", "retry"] } },
    data: { status: "delivering", attemptedAt: new Date() },
  });
  if (claim.count === 0) {
    // Someone else already grabbed it. Treat as a no-op success — the
    // other worker will record the outcome.
    return null;
  }

  // Pre-flight URL validation. Even though we validated at register
  // time, an endpoint may have been updated since — re-check.
  const urlCheck = validateWebhookUrl(endpoint.url);
  let outcomeInput: Parameters<typeof classifyDeliveryOutcome>[0];

  if (!urlCheck.ok) {
    outcomeInput = { httpStatus: null, invalidUrl: true };
  } else if (endpoint.revokedAt !== null) {
    outcomeInput = { httpStatus: null, endpointDisabled: true };
  } else {
    const body = serializeEnvelope(envelope);
    const signatureHex = signWebhookPayload(endpoint.secret, body, envelope.timestampSec);
    const headers = buildWebhookHeaders({
      signatureHex,
      timestampSec: envelope.timestampSec,
      eventId: envelope.eventId,
      eventKind: envelope.type,
      attemptNumber: envelope.attemptNumber,
    });

    // Persist the headers we're about to send (for audit / replay).
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { requestHeaders: headers as unknown as object },
    });

    const fetched = await fetchWithTimeout(
      endpoint.url,
      { method: "POST", headers, body },
      DELIVERY_TIMEOUT_MS,
    );
    outcomeInput = {
      httpStatus: fetched.status,
      networkError: fetched.networkError ?? undefined,
      timedOut: fetched.timedOut,
    };

    // Persist response info immediately (so an audit-side outage
    // doesn't lose the response body).
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        respondedAt: new Date(),
        httpStatus: fetched.status,
        responseBodySnippet: fetched.bodySnippet,
      },
    });
  }

  const outcome = classifyDeliveryOutcome(outcomeInput);

  // Decide retry or finalize.
  let finalStatus: "delivered" | "retry" | "deadletter";
  let nextAttemptAt: Date | null = null;
  let finalDeadletter = false;

  if (outcome.kind === "delivered") {
    finalStatus = "delivered";
  } else if (outcome.retryable) {
    const retry = computeWebhookRetry({ failedAttemptNumber: envelope.attemptNumber });
    if (retry.kind === "schedule_retry") {
      finalStatus = "retry";
      nextAttemptAt = retry.nextAttemptAt!;
      // Enqueue the NEXT attempt as a fresh row so the timeline reads
      // top-to-bottom across attempts.
      await prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          organizationId: delivery.organizationId,
          eventId: envelope.eventId,
          eventKind: envelope.type,
          attemptNumber: envelope.attemptNumber + 1,
          status: "queued",
          nextAttemptAt,
          payload: {
            ...envelope,
            attemptNumber: envelope.attemptNumber + 1,
          } as unknown as object,
        },
      });
    } else {
      finalStatus = "deadletter";
      finalDeadletter = true;
    }
  } else {
    finalStatus = "deadletter";
    finalDeadletter = true;
  }

  // Finalize THIS attempt's row.
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: finalStatus,
      outcomeKind: outcome.kind,
      errorMessage: outcome.kind === "delivered" ? null : outcome.message,
      nextAttemptAt,
    },
  });

  // Update the endpoint's consecutive-failure counter.
  if (outcome.kind === "delivered") {
    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { consecutiveFailures: 0 },
    });
  } else if (outcome.retryable || outcome.kind === "deadletter_4xx") {
    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { consecutiveFailures: { increment: 1 } },
    });
  }

  // Audit (best-effort).
  try {
    await recordAudit({
      organizationId: idFactory.organization(delivery.organizationId),
      actorKind: "system",
      action: outcome.kind === "delivered"
        ? "workforce.webhook_delivered"
        : finalDeadletter
          ? "workforce.webhook_deadlettered"
          : "workforce.webhook_retry_scheduled",
      outcome: outcome.kind === "delivered" ? "success" : "failure",
      entityRef: `webhook_delivery:${deliveryId}`,
      correlationId: idFactory.correlation(envelope.eventId),
      source: "live",
      detail: {
        endpointId: endpoint.id,
        eventKind: envelope.type,
        attemptNumber: envelope.attemptNumber,
        outcomeKind: outcome.kind,
        httpStatus: outcomeInput.httpStatus ?? null,
        nextAttemptAt,
      },
    });
  } catch { /* best-effort */ }

  return {
    deliveryId,
    outcomeKind: outcome.kind,
    retryable: outcome.retryable,
    nextAttemptAt,
    finalDeadletter,
  };
}
