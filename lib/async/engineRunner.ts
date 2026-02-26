import { prisma } from "@/lib/db";
import type { Lead } from "@prisma/client";

type EngineName = "cloud-studio" | "cloud-operator" | "website-builder";

type RunAsyncLeadEngineParams<TResult> = {
  leadId: string;
  engineName: EngineName;
  expectedSource?: string;
  getTier: (lead: Lead, payload: Record<string, unknown>) => string;
  generate: (args: { lead: Lead; tier: string; payload: Record<string, unknown> }) => Promise<TResult>;
  persist: (args: {
    lead: Lead;
    tier: string;
    result: TResult;
    payload: Record<string, unknown>;
  }) => Record<string, unknown>;
  /** If result exists, return it idempotently without regenerating. */
  isReady: (payload: Record<string, unknown>) => boolean;
  /** Extract result from payload for idempotent return. */
  getExistingResult: (payload: Record<string, unknown>) => TResult | null;
};

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    const tv = out[k];
    const sv = source[k];
    if (
      sv != null &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv != null &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      out[k] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      out[k] = sv;
    }
  }
  return out;
}

function getOutputStatus(payload: Record<string, unknown>): string {
  const engine = payload.engine as Record<string, unknown> | undefined;
  const engineStatus = engine?.outputStatus as string | undefined;
  const legacyStatus = payload.outputStatus as string | undefined;
  return engineStatus || legacyStatus || "pending";
}

/**
 * Phase 3 unified async engine runner.
 * - Idempotent when outputStatus is "ready" and result exists.
 * - Updates fullPayload.engine.outputStatus and legacy outputStatus.
 * - Deep-merges persist result; does not clobber existing keys.
 * - On error: sets engine.outputStatus="failed" and engine.errorMessage.
 */
export async function runAsyncLeadEngine<TResult>({
  leadId,
  engineName,
  expectedSource,
  getTier,
  generate,
  persist,
  isReady,
  getExistingResult,
}: RunAsyncLeadEngineParams<TResult>): Promise<{
  lead: Lead;
  generated: TResult;
  payload: Record<string, unknown>;
}> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`[${engineName}] lead not found`);
  }

  if (expectedSource && lead.source !== expectedSource) {
    throw new Error(
      `[${engineName}] invalid lead source: expected "${expectedSource}", got "${lead.source}"`
    );
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const outputStatus = getOutputStatus(payload);

  // Idempotent: if ready and result exists, return without regenerating
  if (outputStatus === "ready" && isReady(payload)) {
    const existing = getExistingResult(payload);
    if (existing != null) {
      return { lead, generated: existing, payload };
    }
  }

  const tier = getTier(lead, payload);
  const now = new Date().toISOString();

  // Set interim status: lead.status + engine.outputStatus
  const interimPayload = deepMerge(payload, {
    engine: {
      ...(payload.engine as Record<string, unknown>),
      outputStatus: "pending",
      engineName,
      updatedAt: now,
    } as Record<string, unknown>,
    outputStatus: "pending",
  } as Record<string, unknown>);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "package_generating",
      fullPayload: interimPayload as object,
    },
  });

  try {
    const result = await generate({ lead, tier, payload });
    const partial = persist({ lead, tier, result, payload });
    const merged = deepMerge({ ...payload, ...interimPayload }, partial);

    const readyPayload = deepMerge(merged, {
      engine: {
        ...(merged.engine as Record<string, unknown>),
        outputStatus: "ready",
        engineName,
        updatedAt: new Date().toISOString(),
      } as Record<string, unknown>,
      outputStatus: "ready",
    } as Record<string, unknown>);

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "package_ready",
        fullPayload: readyPayload as object,
      },
    });

    return { lead: updatedLead, generated: result, payload: readyPayload };
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error during generation";
    try {
      const latest = await prisma.lead.findUnique({ where: { id: leadId } });
      if (latest) {
        const currentPayload = (latest.fullPayload as Record<string, unknown>) || {};
        const failedPayload = deepMerge(currentPayload, {
          engine: {
            ...(currentPayload.engine as Record<string, unknown>),
            outputStatus: "failed",
            engineName,
            errorMessage: errMsg,
            updatedAt: new Date().toISOString(),
          } as Record<string, unknown>,
          outputStatus: "failed",
        } as Record<string, unknown>);

        await prisma.lead.update({
          where: { id: leadId },
          data: {
            status: "created",
            fullPayload: failedPayload as object,
          },
        });
      }
    } catch {
      // ignore
    }
    throw error;
  }
}
