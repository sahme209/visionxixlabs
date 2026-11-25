import { leadFormSchema } from "@/lib/leads/leadSchema";
import { adminGenerationRevision } from "./adminGenerationIntent";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import type { LeadGenerationInvocation } from "@/lib/ai/leadGenerationInvocation";
import { randomUUID } from "node:crypto";
import { GenerationNotDispatchedError } from "@/lib/ai/generationNotDispatched";
import { leadGenerationRecovery, stagedLeadResult, starterGenerationActive } from "./generationRecovery";
import { prisma } from "@/lib/db";
import type { Lead, Prisma } from "@/lib/prismaClient";

export class LeadEngineBusyError extends Error {
  constructor(message = "Generation is already in progress or the lead has changed. Check its status before retrying.") {
    super(message);
  }
}

type EngineName = "cloud-studio" | "cloud-operator" | "website-builder" | "website-starter";

function generationInputHash(engineName: EngineName, source: string, payload: Record<string, unknown>) {
  switch (engineName) {
    case "cloud-operator":
      return sha256ContentHash({ source, tier: payload.tier, operatorProfile: payload.operatorProfile });
    case "cloud-studio":
      return sha256ContentHash({ source, tier: payload.tier, serviceType: payload.serviceType, form: payload.form });
    case "website-starter":
      return sha256ContentHash({ source, form: leadFormSchema.parse(payload) });
    case "website-builder":
      return sha256ContentHash({ source, form: payload.form });
  }
}

export class LeadGenerationRevisionChangedError extends LeadEngineBusyError {
  constructor() {
    super("The lead changed before this request started. Review the refreshed lead before generating again.");
  }
}

type RunAsyncLeadEngineParams<TResult, TCachedResult> = {
  leadId: string;
  engineName: EngineName;
  expectedSource?: string;
  getTier: (lead: Lead, payload: Record<string, unknown>) => string;
  generate: (args: { lead: Lead; tier: string; payload: Record<string, unknown>; invocation: LeadGenerationInvocation }) => Promise<TResult>;
  persist: (args: {
    lead: Lead;
    tier: string;
    result: TResult;
    payload: Record<string, unknown>;
  }) => Record<string, unknown>;
  /** Persist complete report documents without retaining fields from an older report. */
  replacePayloadKeys?: readonly string[];
  adminIntent?: { actorId: string; requestId: string; revision: string };
  /** If result exists, return it idempotently without regenerating. */
  isReady: (payload: Record<string, unknown>) => boolean;
  /** Extract result from payload for idempotent return. */
  getExistingResult: (payload: Record<string, unknown>) => TCachedResult | null;
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

type EngineKey = "engine" | "starterEngine";

function getOutputStatus(payload: Record<string, unknown>, key: EngineKey): string {
  const engine = payload[key] as Record<string, unknown> | undefined;
  const engineStatus = engine?.outputStatus as string | undefined;
  const legacyStatus = payload.outputStatus as string | undefined;
  return engineStatus || (key === "engine" ? legacyStatus : undefined) || "pending";
}

function generationActive(lead: Lead, key: EngineKey) {
  return key === "engine" ? lead.status === "package_generating" :
    starterGenerationActive((lead.fullPayload as Record<string, unknown>) ?? {});
}

function ownsClaim(lead: Lead, runId: string, key: EngineKey): boolean {
  const payload = lead.fullPayload as Partial<Record<EngineKey, { runId?: string }>> | null;
  return payload?.[key]?.runId === runId;
}

function leadInvocation(leadId: string, runId: string, key: EngineKey): LeadGenerationInvocation {
  const requestId = `lead_${runId}`;
  return {
    requestId,
    async recordGatewayGeneration(generationId) {
      if (!generationId || !/^[A-Za-z0-9_-]{1,128}$/.test(generationId)) {
        throw new Error("lead_gateway_receipt_unconfirmed");
      }
      const row = await prisma.lead.findUnique({ where: { id: leadId } });
      if (!row || !generationActive(row, key) || !ownsClaim(row, runId, key)) {
        throw new LeadEngineBusyError();
      }
      const payload = row.fullPayload as Record<string, unknown>;
      const engine = payload[key] as Record<string, unknown>;
      if (engine.dispatchState !== "started" || engine.providerReceipt != null) {
        throw new LeadEngineBusyError();
      }
      const recorded = await prisma.lead.updateMany({
        where: {
          id: leadId, status: row.status, updatedAt: row.updatedAt,
          fullPayload: { equals: row.fullPayload as Prisma.InputJsonValue },
        },
        data: {
          fullPayload: deepMerge(payload, {
            [key]: { providerReceipt: { provider: "vercel_gateway", requestId, generationId } },
          }) as Prisma.InputJsonObject,
        },
      });
      if (recorded.count !== 1) throw new LeadEngineBusyError();
    },
  };
}

/**
 * Phase 3 unified async engine runner.
 * - Idempotent when outputStatus is "ready" and result exists.
 * - Updates fullPayload.engine.outputStatus and legacy outputStatus.
 * - Deep-merges persist result; does not clobber existing keys.
 * - Fences dispatch against a durable reservation and retains uncertain outcomes.
 */
export async function runAsyncLeadEngine<TResult, TCachedResult = TResult>({
  leadId,
  engineName,
  expectedSource,
  getTier,
  generate,
  persist,
  replacePayloadKeys = [],
  adminIntent,
  isReady,
  getExistingResult,
}: RunAsyncLeadEngineParams<TResult, TCachedResult>): Promise<{
  lead: Lead;
  payload: Record<string, unknown>;
} & ({ reused: true; generated: TCachedResult } | { reused: false; generated: TResult })> {
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
  const source = lead.source;
  const key = engineName === "website-starter" ? "starterEngine" : "engine";

  function generationStatus(status: string) {
    return key === "engine" ? { outputStatus: status } : {};
  }

  function resultingLeadStatus(row: Lead, normalStatus: string) {
    return key === "engine" ? normalStatus : row.status;
  }

  function cached(ready: Lead) {
    const readyPayload = (ready.fullPayload as Record<string, unknown>) || {};
    if (getOutputStatus(readyPayload, key) !== "ready" || !isReady(readyPayload)) return null;
    const generated = getExistingResult(readyPayload);
    return generated == null ? null : { lead: ready, payload: readyPayload, generated, reused: true as const };
  }

  async function publishStaged(current: Lead, runId: string) {
    if (current.source !== source || !generationActive(current, key) || !ownsClaim(current, runId, key)) {
      throw new LeadEngineBusyError();
    }
    const currentPayload = current.fullPayload as Record<string, unknown>;
    const stage = stagedLeadResult(currentPayload, key);
    if (!stage || stage.engineName !== engineName || stage.runId !== runId ||
        stage.inputHash !== generationInputHash(engineName, source, currentPayload) ||
        !isReady(stage.patch) || getExistingResult(stage.patch) == null) {
      throw new LeadEngineBusyError();
    }
    const merged = deepMerge(currentPayload, stage.patch);
    for (const key of replacePayloadKeys) {
      if (Object.hasOwn(stage.patch, key)) merged[key] = stage.patch[key];
    }
    const readyPayload = deepMerge(merged, {
      [key]: {
        outputStatus: "ready",
        engineName,
        dispatchState: "completed",
        stagedResult: null,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      },
      ...generationStatus("ready"),
    });
    const completedStatus = resultingLeadStatus(current, "package_ready");
    const candidate = cached({ ...current, status: completedStatus, fullPayload: readyPayload as Prisma.JsonObject });
    if (!candidate) throw new LeadEngineBusyError("The saved report could not be verified for recovery.");

    try {
      const saved = await prisma.lead.update({
        where: {
          id: leadId, source: current.source, status: current.status, updatedAt: current.updatedAt,
          fullPayload: { equals: current.fullPayload as Prisma.InputJsonValue },
        },
        data: { status: completedStatus, fullPayload: readyPayload as Prisma.InputJsonObject },
      });
      return { ...candidate, lead: saved, published: true };
    } catch (error) {
      // A concurrent recovery or a lost write acknowledgement can leave the
      // same result already committed. Only accept a fresh read of this run.
      const latest = await prisma.lead.findUnique({ where: { id: leadId } }).catch(() => null);
      const existing = latest?.source === source && ownsClaim(latest, runId, key) && cached(latest);
      if (existing) return { ...existing, published: false };
      throw error;
    }
  }

  const inputHash = generationInputHash(engineName, source, payload);
  const intent = adminIntent ? {
    key: sha256ContentHash({ leadId, actorId: adminIntent.actorId, requestId: adminIntent.requestId }),
    revision: adminIntent.revision,
    inputHash,
  } : null;
  const engine = payload[key] as {
    adminIntent?: typeof intent;
    dispatchState?: string;
  } | undefined;
  const storedIntent = engine?.adminIntent;
  if (intent && storedIntent?.key === intent.key) {
    if (storedIntent.revision !== intent.revision || storedIntent.inputHash !== intent.inputHash) {
      throw new LeadGenerationRevisionChangedError();
    }
    const existing = cached(lead);
    if (existing) return existing;
    if (!generationActive(lead, key) && engine?.dispatchState !== "not_dispatched") {
      throw new LeadEngineBusyError();
    }
  } else if (intent) {
    if (generationActive(lead, key)) throw new LeadEngineBusyError();
    if (intent.revision !== adminGenerationRevision(lead)) throw new LeadGenerationRevisionChangedError();
  } else {
    const existing = cached(lead);
    if (existing) return existing;
    if (generationActive(lead, key) && engine?.dispatchState === "reserved" && storedIntent) {
      throw new LeadEngineBusyError();
    }
  }

  if (generationActive(lead, key === "engine" ? "starterEngine" : "engine")) throw new LeadEngineBusyError();

  const staged = stagedLeadResult(payload, key);
  if (generationActive(lead, key) && staged) {
    const { published: _published, ...recovered } = await publishStaged(lead, staged.runId);
    return recovered;
  }

  const recovery = leadGenerationRecovery(lead.status, payload, key);
  if (recovery && !recovery.retryAllowed) {
    throw new LeadEngineBusyError(recovery.state === "dispatch_started"
      ? "Generation has started. Check its status before retrying."
      : "The previous generation outcome is unconfirmed. Another AI request would require reconciliation.");
  }

  const tier = getTier(lead, payload);
  const runId = randomUUID();

  // Set interim status: lead.status + engine.outputStatus
  const interimPayload = deepMerge(payload, {
    [key]: {
      outputStatus: "pending",
      engineName,
      updatedAt: new Date().toISOString(),
      runId,
      dispatchState: "reserved",
      providerReceipt: null,
      stagedResult: null,
      adminIntent: intent,
    },
    ...generationStatus("pending"),
  });

  const claimedStatus = resultingLeadStatus(lead, "package_generating");
  const claim = await prisma.lead.updateMany({
    where: {
      id: leadId,
      source: lead.source,
      status: lead.status,
      updatedAt: lead.updatedAt,
      fullPayload: { equals: lead.fullPayload as Prisma.InputJsonValue },
    },
    data: {
      status: claimedStatus,
      fullPayload: interimPayload as object,
    },
  });
  if (claim.count !== 1) {
    throw new LeadEngineBusyError();
  }

  // A concurrent caller may replace a reservation, but only the caller that
  // advances its own reservation can enter the generator.
  const dispatch = await prisma.lead.updateMany({
    where: {
      id: leadId,
      status: claimedStatus,
      fullPayload: { equals: interimPayload as Prisma.InputJsonObject },
    },
    data: {
      fullPayload: deepMerge(interimPayload, { [key]: { dispatchState: "started" } }) as Prisma.InputJsonObject,
    },
  });
  if (dispatch.count !== 1) {
    throw new LeadEngineBusyError();
  }

  let result: TResult;
  try {
    result = await generate({ lead, tier, payload, invocation: leadInvocation(leadId, runId, key) });
  } catch (error) {
    const safeToRetry = error instanceof GenerationNotDispatchedError;
    try {
      const latest = await prisma.lead.findUnique({ where: { id: leadId } });
      if (latest && generationActive(latest, key) && ownsClaim(latest, runId, key)) {
        const currentPayload = (latest.fullPayload as Record<string, unknown>) || {};
        const failedPayload = deepMerge(currentPayload, {
          [key]: {
            outputStatus: "failed",
            engineName,
            dispatchState: safeToRetry ? "not_dispatched" : "outcome_unconfirmed",
            errorMessage: safeToRetry ? "Generation was refused before contacting the provider." : "Generation outcome could not be confirmed.",
            updatedAt: new Date().toISOString(),
          },
          ...generationStatus("failed"),
        });

        await prisma.lead.updateMany({
          where: {
            id: leadId,
            status: latest.status,
            updatedAt: latest.updatedAt,
            fullPayload: { path: [key, "runId"], equals: runId },
          },
          data: { status: safeToRetry ? resultingLeadStatus(latest, "created") : latest.status, fullPayload: failedPayload as object },
        });
      }
    } catch {
      // Preserve the original generation error.
    }
    throw error;
  }

  const latest = await prisma.lead.findUnique({ where: { id: leadId } });
  if (latest?.source !== source || !generationActive(latest, key) || !ownsClaim(latest, runId, key)) {
    throw new LeadEngineBusyError();
  }
  const currentPayload = (latest.fullPayload as Record<string, unknown>) || {};
  if (generationInputHash(engineName, source, currentPayload) !== inputHash) {
    throw new LeadEngineBusyError("The report inputs changed before the result could be saved.");
  }
  const partial = persist({ lead: latest, tier, result, payload: currentPayload });
  const stagedPayload = deepMerge(currentPayload, {
    [key]: { dispatchState: "result_staged", stagedResult: { runId, inputHash, patch: partial } },
  });
  const stagedUpdate = await prisma.lead.updateMany({
    where: {
      id: leadId, source: latest.source, status: latest.status, updatedAt: latest.updatedAt,
      fullPayload: { equals: latest.fullPayload as Prisma.InputJsonValue },
    },
    data: { fullPayload: stagedPayload as Prisma.InputJsonObject },
  });
  if (stagedUpdate.count !== 1) throw new LeadEngineBusyError();

  const stagedLead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!stagedLead) throw new LeadEngineBusyError();
  const existing = stagedLead.source === source && ownsClaim(stagedLead, runId, key) && cached(stagedLead);
  if (existing) return existing;
  const { published, ...saved } = await publishStaged(stagedLead, runId);
  return published ? { ...saved, generated: result, reused: false } : saved;
}
