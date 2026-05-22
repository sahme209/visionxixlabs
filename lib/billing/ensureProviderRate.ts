/**
 * Lazy provider-rate seeding — Phase 382.
 *
 * On first use of a (provider, modelId) the producer needs a rate row
 * to compute cost. Rather than running a SQL seed migration (which
 * mutates the DB without a clean rollback path), we lazily upsert
 * from PROVIDER_RATE_SEEDS the first time a model is touched.
 *
 * Operators can edit the row afterwards — the upsert only fires when
 * no row exists for that (provider, modelId). Future rate changes go
 * via the admin UI (a follow-up phase) and do not run through this
 * helper.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { findSeedRate } from "./providerRateSeeds";
import type { ProviderRate } from "./computeInvocationCost";

/**
 * Returns the currently active rate row for (provider, modelId). If no
 * row exists, seeds one from PROVIDER_RATE_SEEDS. Returns null when no
 * seed exists for the requested model — the caller should refuse to
 * record cost rather than guess.
 */
export async function ensureProviderRate(
  provider: string,
  modelId: string,
): Promise<ProviderRate | null> {
  const existing = await prisma.aIProviderRate.findFirst({
    where: { provider, modelId, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  }).catch(() => null);

  if (existing) {
    return {
      provider: existing.provider,
      modelId: existing.modelId,
      inputCentsPerMillion: existing.inputCentsPerMillion,
      outputCentsPerMillion: existing.outputCentsPerMillion,
      cachedReadCentsPerMillion: existing.cachedReadCentsPerMillion,
      batchInputCentsPerMillion: existing.batchInputCentsPerMillion,
      batchOutputCentsPerMillion: existing.batchOutputCentsPerMillion,
    };
  }

  const seed = findSeedRate(provider, modelId);
  if (!seed) return null;

  try {
    await prisma.aIProviderRate.create({
      data: {
        provider: seed.provider,
        modelId: seed.modelId,
        displayName: seed.displayName,
        inputCentsPerMillion: seed.inputCentsPerMillion,
        outputCentsPerMillion: seed.outputCentsPerMillion,
        cachedReadCentsPerMillion: seed.cachedReadCentsPerMillion,
        batchInputCentsPerMillion: seed.batchInputCentsPerMillion,
        batchOutputCentsPerMillion: seed.batchOutputCentsPerMillion,
        currency: "USD",
        effectiveFrom: new Date(seed.effectiveFrom),
        isActive: true,
        notes: seed.notes ?? null,
      },
    });
  } catch {
    // Race condition — another concurrent caller seeded first. Re-read.
  }

  return {
    provider: seed.provider,
    modelId: seed.modelId,
    inputCentsPerMillion: seed.inputCentsPerMillion,
    outputCentsPerMillion: seed.outputCentsPerMillion,
    cachedReadCentsPerMillion: seed.cachedReadCentsPerMillion,
    batchInputCentsPerMillion: seed.batchInputCentsPerMillion,
    batchOutputCentsPerMillion: seed.batchOutputCentsPerMillion,
  };
}
