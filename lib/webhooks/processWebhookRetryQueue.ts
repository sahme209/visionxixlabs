/**
 * Webhook retry-queue worker — Phase 395.
 *
 * Cron-invoked. Picks all `WebhookDelivery` rows where:
 *   - status = "queued" AND nextAttemptAt <= now()
 *
 * For each, calls `deliverWebhookDelivery(id)` which performs the
 * HTTP attempt, classifies the outcome, and schedules the next retry
 * (or deadletters) via the pure kernels.
 *
 * Designed to be safely re-invoked: every row claim is an atomic
 * compare-and-swap inside `deliverWebhookDelivery` (status → "delivering"),
 * so two concurrent workers can't double-deliver.
 *
 * Vercel-cron-shaped: returns a JSON-able summary so the operator can
 * see how many rows fired in each invocation.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { deliverWebhookDelivery } from "./deliverWebhook";

const INTERNAL_WORKSPACE_ID = "ws_internal_admin_visionxixlabs";

export interface RetryQueueResult {
  attempted: number;
  delivered: number;
  rescheduled: number;
  deadlettered: number;
  durationMs: number;
}

export interface RetryQueueOptions {
  /** Max rows to process per invocation (Vercel cron has a 60s ceiling). */
  maxBatchSize?: number;
  /** "now" override for tests. */
  now?: Date;
}

const DEFAULT_BATCH_SIZE = 50;

export async function processWebhookRetryQueue(options: RetryQueueOptions = {}): Promise<RetryQueueResult> {
  const t0 = Date.now();
  const now = options.now ?? new Date();
  const batchSize = options.maxBatchSize ?? DEFAULT_BATCH_SIZE;

  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: "queued",
      OR: [
        { nextAttemptAt: null },        // first-attempt rows that weren't fired inline
        { nextAttemptAt: { lte: now } },// scheduled retries that are due
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });

  let delivered = 0;
  let rescheduled = 0;
  let deadlettered = 0;

  for (const row of due) {
    const r = await deliverWebhookDelivery(row.id);
    if (!r) continue;
    if (r.outcomeKind === "delivered") delivered++;
    else if (r.finalDeadletter) deadlettered++;
    else if (r.retryable) rescheduled++;
    else deadlettered++;  // non-retryable, non-delivered = deadletter
  }

  const durationMs = Date.now() - t0;

  try {
    await recordAudit({
      organizationId: idFactory.organization(INTERNAL_WORKSPACE_ID),
      actorKind: "system",
      action: "workforce.webhook_queue_processed",
      outcome: "success",
      entityRef: "webhook_retry_queue",
      correlationId: idFactory.correlation(`webhook_queue_${t0.toString(36)}`),
      source: "live",
      detail: {
        attempted: due.length,
        delivered,
        rescheduled,
        deadlettered,
        durationMs,
        batchSize,
      },
    });
  } catch { /* best-effort */ }

  return {
    attempted: due.length,
    delivered,
    rescheduled,
    deadlettered,
    durationMs,
  };
}
