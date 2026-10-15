/**
 * Durable AI usage settlement.
 *
 * Gateway reconciliation establishes the authoritative provider cost first.
 * This module turns only those settled events into Stripe invoice items.  It
 * is intentionally test-mode only: a live Stripe key is never a valid input
 * for this job, regardless of other billing settings.
 */

import "server-only";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { evaluateAIUsageSettlementRetry } from "./aiUsageSettlementRetryPolicy";
import { aiUsageSettlementCandidates } from "./aiUsageSettlementCandidates";
import { isAIUsageSettlementBoundToUsage } from "./aiUsageSettlementBinding";

type SettledUsage = {
  id: string;
  organizationId: string;
  billedCents: number;
};

type SettlementRecord = {
  id: string;
  organizationId: string;
  usageEventId: string;
  periodMonth: string;
  amountCents: number;
  idempotencyKey: string;
  status: string;
  attemptCount: number;
  createdAt: Date;
};

type BillingRepository = {
  $queryRaw: <T>(query: Prisma.Sql) => Promise<T>;
  tenantBillingPlan: { findUnique(args: unknown): Promise<{ stripeCustomerId: string | null } | null> };
  aIUsageBillingConfig: { findUnique(args: unknown): Promise<{ enabled: boolean; monthlySpendLimitCents: number; currency: string } | null> };
  aIUsageBillingPeriod: {
    findUnique(args: unknown): Promise<{ reservedCents: number } | null>;
    create(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  aIUsageBillingSettlement: {
    findUnique(args: unknown): Promise<SettlementRecord | null>;
    create(args: unknown): Promise<SettlementRecord>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  $transaction: <T>(operation: (tx: BillingRepository) => Promise<T>, options?: unknown) => Promise<T>;
};

export interface AIUsageSettlementResult {
  inspected: number;
  reserved: number;
  submitted: number;
  blocked: number;
  deferred: number;
}

function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function testModeFailure(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (process.env.AXIOM_AI_USAGE_BILLING_TEST_ENABLED !== "true") {
    return "AI usage settlement is disabled (set AXIOM_AI_USAGE_BILLING_TEST_ENABLED=true only in a Stripe test environment).";
  }
  if (process.env.AXIOM_STRIPE_MODE?.trim().toLowerCase() !== "test" || !key.startsWith("sk_test_")) {
    return "AI usage settlement requires AXIOM_STRIPE_MODE=test and an sk_test_ key; live Stripe is intentionally rejected.";
  }
  return null;
}

async function submitInvoiceItem(record: SettlementRecord, customerId: string, currency: string): Promise<{ ok: true; stripeInvoiceItemId: string } | { ok: false }> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return { ok: false };
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key, { apiVersion: "2026-01-28.clover" });
    const item = await stripe.invoiceItems.create({
      customer: customerId,
      amount: record.amountCents,
      currency,
      description: `Axiom AI usage (${record.periodMonth})`,
      metadata: {
        purpose: "axiom_ai_usage",
        organizationId: record.organizationId,
        usageEventId: record.usageEventId,
        settlementId: record.id,
      },
    }, { idempotencyKey: record.idempotencyKey });
    return { ok: true, stripeInvoiceItemId: item.id };
  } catch {
    // Preserve the reservation. Automatic retries reuse the original key only
    // within our bounded window; old unknown outcomes require reconciliation.
    return { ok: false };
  }
}

/**
 * Create test-mode Stripe invoice items for reconciled AI usage.
 * A missing opt-in, Stripe customer, configuration, or budget blocks rather
 * than estimates or silently bills.  The transaction uses Serializable so
 * concurrent cron invocations cannot over-reserve the monthly ceiling.
 */
export async function settleAIUsageToStripe(
  repository: BillingRepository = prisma as unknown as BillingRepository,
  limit = 100,
): Promise<AIUsageSettlementResult> {
  const disabled = testModeFailure();
  if (disabled) return { inspected: 0, reserved: 0, submitted: 0, blocked: 0, deferred: 0 };

  const selectionTime = new Date();
  const usage = await repository.$queryRaw<SettledUsage[]>(aiUsageSettlementCandidates(limit, selectionTime));
  const result: AIUsageSettlementResult = { inspected: usage.length, reserved: 0, submitted: 0, blocked: 0, deferred: 0 };
  const periodMonth = monthKey(selectionTime);

  for (const event of usage) {
    const config = await repository.aIUsageBillingConfig.findUnique({ where: { organizationId: event.organizationId } });
    const plan = await repository.tenantBillingPlan.findUnique({ where: { organizationId: event.organizationId }, select: { stripeCustomerId: true } });
    if (!config?.enabled || config.monthlySpendLimitCents <= 0 || !plan?.stripeCustomerId) {
      result.blocked++;
      continue;
    }

    let settlement: SettlementRecord | null = null;
    try {
      settlement = await repository.$transaction(async (tx) => {
        const existing = await tx.aIUsageBillingSettlement.findUnique({ where: { usageEventId: event.id } });
        if (existing) return existing;
        const current = await tx.aIUsageBillingPeriod.findUnique({
          where: { organizationId_periodMonth: { organizationId: event.organizationId, periodMonth } },
        });
        if (!current) {
          if (event.billedCents > config.monthlySpendLimitCents) return null;
          await tx.aIUsageBillingPeriod.create({ data: {
            organizationId: event.organizationId, periodMonth, limitCents: config.monthlySpendLimitCents, reservedCents: event.billedCents,
          } });
        } else {
          if (current.reservedCents < 0) return null;
          const reserved = await tx.aIUsageBillingPeriod.updateMany({
            where: {
              organizationId: event.organizationId,
              periodMonth,
              reservedCents: { gte: 0, lte: config.monthlySpendLimitCents - event.billedCents },
            },
            data: { reservedCents: { increment: event.billedCents }, limitCents: config.monthlySpendLimitCents },
          });
          if (reserved.count !== 1) return null;
        }
        return tx.aIUsageBillingSettlement.create({ data: {
          organizationId: event.organizationId,
          usageEventId: event.id,
          periodMonth,
          amountCents: event.billedCents,
          idempotencyKey: `axiom-ai-usage-${event.id}`,
          status: "reserved",
        } }) as Promise<SettlementRecord>;
      }, { isolationLevel: "Serializable" });
    } catch {
      result.deferred++;
      continue;
    }
    if (!settlement || !isAIUsageSettlementBoundToUsage(event, settlement)) {
      // Hold any existing reservation for reconciliation. Never submit a
      // different tenant/event/amount or release an unknown provider outcome.
      result.blocked++;
      continue;
    }
    const retry = evaluateAIUsageSettlementRetry(settlement, new Date());
    if (retry === "already_submitted") continue;
    if (retry === "needs_reconciliation") {
      result.blocked++;
      continue;
    }
    if (!Number.isSafeInteger(settlement.attemptCount) || settlement.attemptCount < 0) {
      result.blocked++;
      continue;
    }
    try {
      // Claim the observed attempt count and persist queue rotation before Stripe,
      // including uncertain outcomes. Never move createdAt: it bounds the original retry window.
      const attempt = await repository.aIUsageBillingSettlement.updateMany({
        where: {
          id: settlement.id, status: "reserved",
          organizationId: event.organizationId, usageEventId: event.id,
          amountCents: event.billedCents, idempotencyKey: settlement.idempotencyKey,
          createdAt: settlement.createdAt, attemptCount: settlement.attemptCount,
        },
        data: { attemptCount: { increment: 1 }, updatedAt: new Date() },
      });
      if (attempt.count !== 1) {
        result.deferred++;
        continue;
      }
    } catch {
      result.deferred++;
      continue;
    }
    // A slow metadata write must not extend automatic retry eligibility.
    if (evaluateAIUsageSettlementRetry(settlement, new Date()) !== "submit") {
      result.blocked++;
      continue;
    }
    result.reserved++;
    const submission = await submitInvoiceItem(settlement, plan.stripeCustomerId, config.currency.toLowerCase());
    if (!submission.ok) {
      result.deferred++;
      continue;
    }
    await repository.aIUsageBillingSettlement.updateMany({
      where: { id: settlement.id, status: "reserved" },
      data: { status: "submitted", stripeInvoiceItemId: submission.stripeInvoiceItemId, submittedAt: new Date() },
    });
    result.submitted++;
  }
  return result;
}

export function describeAIUsageSettlementGate(): { enabled: boolean; reason?: string } {
  const reason = testModeFailure();
  return reason ? { enabled: false, reason } : { enabled: true };
}
