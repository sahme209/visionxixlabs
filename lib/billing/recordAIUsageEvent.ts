/**
 * AI usage event producer — Phase 382.
 *
 * After a model call returns, write a UsageEvent row with the
 * computed cost. Pulls the rate via ensureProviderRate (lazy-seeded),
 * runs computeInvocationCost(), persists. All steps are best-effort
 * — a Prisma failure here MUST NOT propagate up and break the
 * producing executor; observability matters but it can't take down
 * the work it's instrumenting.
 *
 * Returns the cost breakdown so the caller can include it in their
 * own response detail / audit row.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { ensureProviderRate } from "./ensureProviderRate";
import { computeInvocationCost, type CostBreakdown } from "./computeInvocationCost";

export interface RecordAIUsageInput {
  organizationId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedReadTokens?: number;
  /** Who triggered the call (operator user id, agent id, "system:..." for crons). */
  triggeredBy?: string;
  /** Optional correlation id to thread through audit. */
  correlationId?: string;
  /** Optional AIInvocation row id when one was written via the legacy logger. */
  aiInvocationId?: string;
  /** Extra context — engineer id, stage id, pipeline run id, etc. */
  metadata?: Record<string, unknown>;
  /** Gateway generation id. Required for authoritative Gateway cost settlement. */
  externalUsageId?: string;
}

export interface RecordAIUsageResult {
  /** False when the rate row could not be located — the caller should fall back to dry-run. */
  recorded: boolean;
  usageEventId: string | null;
  cost: CostBreakdown | null;
  pendingSettlement?: boolean;
  /** Reason when recorded === false. */
  reason?: "no_rate_row" | "missing_external_usage_id" | "persist_failed";
}

export async function recordAIUsageEvent(input: RecordAIUsageInput): Promise<RecordAIUsageResult> {
  if (input.provider === "vercel_gateway") {
    if (!input.externalUsageId) {
      return { recorded: false, usageEventId: null, cost: null, reason: "missing_external_usage_id" };
    }
    try {
      const event = await prisma.usageEvent.upsert({
        where: { externalUsageId: input.externalUsageId },
        update: {},
        create: {
          organizationId: input.organizationId,
          externalUsageId: input.externalUsageId,
          eventKind: "ai_invocation",
          provider: input.provider,
          model: input.model,
          inputTokens: Math.max(0, Math.floor(input.inputTokens)),
          outputTokens: Math.max(0, Math.floor(input.outputTokens)),
          cachedReadTokens: Math.max(0, Math.floor(input.cachedReadTokens ?? 0)),
          costCents: 0,
          billedCents: 0,
          billingStatus: "pending",
          triggeredBy: input.triggeredBy ?? null,
          correlationId: input.correlationId ?? null,
          aiInvocationId: input.aiInvocationId ?? null,
          metadata: { ...(input.metadata ?? {}), costSource: "gateway_generation_lookup" } as object,
        },
      });
      return { recorded: true, usageEventId: event.id, cost: null, pendingSettlement: event.billingStatus === "pending" };
    } catch {
      return { recorded: false, usageEventId: null, cost: null, reason: "persist_failed" };
    }
  }

  const rate = await ensureProviderRate(input.provider, input.model);
  if (!rate) {
    return { recorded: false, usageEventId: null, cost: null, reason: "no_rate_row" };
  }

  const cost = computeInvocationCost(
    {
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cachedReadTokens: input.cachedReadTokens ?? 0,
    },
    rate,
  );

  try {
    const event = await prisma.usageEvent.create({
      data: {
        organizationId: input.organizationId,
        eventKind: "ai_invocation",
        provider: input.provider,
        model: input.model,
        inputTokens: Math.max(0, Math.floor(input.inputTokens)),
        outputTokens: Math.max(0, Math.floor(input.outputTokens)),
        cachedReadTokens: Math.max(0, Math.floor(input.cachedReadTokens ?? 0)),
        costCents: cost.totalCents,
        billedCents: cost.totalCents,
        billingStatus: "settled",
        triggeredBy: input.triggeredBy ?? null,
        correlationId: input.correlationId ?? null,
        aiInvocationId: input.aiInvocationId ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    });
    return { recorded: true, usageEventId: event.id, cost };
  } catch {
    return { recorded: false, usageEventId: null, cost, reason: "persist_failed" };
  }
}
