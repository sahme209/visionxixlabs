import "server-only";

import { gateway } from "ai";
import { prisma } from "@/lib/db";
import { applyMargin } from "./aiBillingMargin";

export interface PendingGatewayUsage {
  id: string;
  externalUsageId: string | null;
}

export interface GatewayGenerationUsage {
  id: string;
  totalCost: number;
  model: string;
  providerName: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export interface GatewayUsageRepository {
  usageEvent: {
    findMany(args: unknown): Promise<PendingGatewayUsage[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  aIUsageReservation?: {
    findUnique(args: unknown): Promise<{ id: string; organizationId: string; reservedCents: number } | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
}

export interface GatewayUsageReconciliationResult {
  inspected: number;
  settled: number;
  deferred: number;
  failed: number;
}

type GenerationLookup = (id: string) => Promise<GatewayGenerationUsage>;

function centsFromUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) throw new Error("invalid_gateway_cost");
  // The prepaid wallet is cent-denominated. Rounding up prevents a completed
  // sub-cent generation from silently becoming unmetered usage.
  return Math.ceil((usd * 100) - Number.EPSILON);
}

function isNotYetAvailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  return candidate.status === 404 || candidate.statusCode === 404;
}

export async function reconcilePendingGatewayUsage(
  repository: GatewayUsageRepository = prisma as unknown as GatewayUsageRepository,
  lookup: GenerationLookup = (id) => gateway.getGenerationInfo({ id }),
  limit = 100,
): Promise<GatewayUsageReconciliationResult> {
  const pending = await repository.usageEvent.findMany({
    where: {
      provider: "vercel_gateway",
      billingStatus: "pending",
      externalUsageId: { not: null },
    },
    select: { id: true, externalUsageId: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(500, Math.floor(limit))),
  });

  let settled = 0;
  let deferred = 0;
  let failed = 0;

  for (const event of pending) {
    if (!event.externalUsageId) {
      failed++;
      continue;
    }
    try {
      const generation = await lookup(event.externalUsageId);
      const providerCostCents = centsFromUsd(generation.totalCost);
      const computedBilledCents = Math.max(providerCostCents, applyMargin(providerCostCents));
      const reservation = repository.aIUsageReservation
        ? await repository.aIUsageReservation.findUnique({ where: { usageEventId: event.id }, select: { id: true, organizationId: true, reservedCents: true } })
        : null;
      // A customer debit is never allowed to exceed the budget explicitly
      // reserved before this generation. Any provider overrun is platform
      // cost to investigate, not an unapproved customer charge.
      const billedCents = reservation ? Math.min(computedBilledCents, reservation.reservedCents) : computedBilledCents;
      const update = await repository.usageEvent.updateMany({
        where: { id: event.id, billingStatus: "pending" },
        data: {
          model: generation.model,
          inputTokens: Math.max(0, Math.floor(generation.promptTokens)),
          outputTokens: Math.max(0, Math.floor(generation.completionTokens)),
          cachedReadTokens: Math.max(0, Math.floor(generation.cachedTokens)),
          costCents: providerCostCents,
          billedCents,
          billingStatus: "settled",
        },
      });
      if (update.count === 1) {
        if (reservation && repository.aIUsageReservation) {
          await repository.aIUsageReservation.updateMany({
            where: { id: reservation.id, organizationId: reservation.organizationId, status: "reserved", usageEventId: event.id },
            data: { status: "settled", settledCents: billedCents, settledAt: new Date() },
          });
        }
        settled++;
      }
    } catch (error) {
      if (isNotYetAvailable(error)) deferred++;
      else failed++;
    }
  }

  return { inspected: pending.length, settled, deferred, failed };
}
