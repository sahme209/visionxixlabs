import { effectiveGatewayModel, gatewayModelOutputBoundVerified } from "@/lib/ai/effectiveGatewayModel";
import { boundedAIInput } from "@/lib/ai/inputByteBound";
/**
 * Real Vercel AI Gateway-backed code_propose executor.
 *
 * Repository proposals use the workspace-selected Gateway model and fail
 * closed when Gateway, policy, metadata, or credits are unavailable.
 * No direct model-provider credential is accepted by this workflow.
 */

import "server-only";
import { createHash } from "node:crypto";
import type { AITextResponse } from "@/lib/ai/AIProvider";
import { admitAIText } from "@/lib/billing/governedExtractAdmission";
import { AI_REQUEST_MAX_OUTPUT_TOKENS } from "@/lib/billing/requestReservationCents";

import { buildCodeProposeMessages } from "./buildCodeProposeMessages";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { prisma } from "@/lib/db";
import { validateProposal } from "./validateProposal";
import { planRefinementAction } from "./planRefinementAction";
import { buildRefinementMessages } from "./buildRefinementMessages";

/** Keep responses bounded even when the selected Gateway model supports more. */
const CODE_PROPOSE_MAX_TOKENS = AI_REQUEST_MAX_OUTPUT_TOKENS;

class CodeProposalCallRefusal extends Error {
  constructor(readonly code: "policy_unavailable" | "policy_changed" | "reservation_refused" | "billing_actor_unavailable" | "output_bound_unverified") {
    super(code === "billing_actor_unavailable" ? "Coding generation requires a verified workspace billing actor. No automatic owner substitution is allowed."
      : code === "reservation_refused" ? "AI credit reservation was refused. No further generation was run."
      : "Workspace AI policy changed or could not be verified. No further generation was run.");
    this.name = "CodeProposalCallRefusal";
  }
}

interface CodeProposeRunMetadata {
  instruction?: unknown;
  repoRef?: unknown;
  branchHint?: unknown;
  repoContext?: unknown;
}

function readMetadata(raw: Record<string, unknown>): {
  instruction: string;
  repoRef: string;
  branchHint: string | null;
  repoContext: string | undefined;
} | null {
  const m = raw as CodeProposeRunMetadata;
  if (typeof m.instruction !== "string" || m.instruction.length === 0) return null;
  if (typeof m.repoRef !== "string" || m.repoRef.length === 0) return null;
  return {
    instruction: m.instruction,
    repoRef: m.repoRef,
    branchHint: typeof m.branchHint === "string" && m.branchHint.length > 0 ? m.branchHint : null,
    repoContext: typeof m.repoContext === "string" && m.repoContext.length > 0 ? m.repoContext : undefined,
  };
}

export const codeProposeRealExecutor: StageExecutorFn = async (ctx) => {
  // Missing Gateway configuration is an explicit failure. Never fabricate a
  // dry-run AI response for a customer workflow.
  if (!getAIProviderManager().isServiceProviderAvailable("vercel_gateway")) {
    return { ok: false, error: "Vercel AI Gateway is not configured.", detail: { stageId: ctx.stageId, gatewayUnavailable: true } };
  }

  // 2. Validate run metadata. Coding tasks created via /api/workforce/coding-tasks
  //    populate { instruction, repoRef, branchHint } — see lib/workforce/pipelines/
  //    parseCodingTaskBody.ts. If a different caller starts the ai_coding pipeline
  //    without those fields, fail instead of inventing a proposal.
  const meta = readMetadata(ctx.runMetadata);
  if (!meta) {
    return { ok: false, error: "Repository proposal metadata is incomplete.", detail: { stageId: ctx.stageId, missingMetadata: true } };
  }

  // 3. Pre-flight AI credit gate — Phase 382. Block hard_stop plans whose
  //    monthly AI credit pool is exhausted. Soft-warn thresholds (70/90%)
  //    don't block but get reflected in the response detail. Metered-billing
  //    and custom-contract plans always pass.
  const preflight = await checkWorkspaceAICredits(ctx.organizationId, undefined, { failClosedOnUsageReadError: true });
  if (preflight.kind === "block") {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "billing.credit_pool_exhausted",
        outcome: "blocked",
        entityRef: `coding_task:${ctx.runId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: {
          stageId: ctx.stageId,
          threshold: preflight.threshold,
          projectedRatio: preflight.projectedRatio,
        },
      });
    } catch { /* best-effort */ }
    return {
      ok: false,
      error: "AI credit pool exhausted on this plan. Upgrade or wait for next month's reset.",
      detail: {
        stageId: ctx.stageId,
        creditPoolExhausted: true,
        threshold: preflight.threshold,
        remainingCents: preflight.remainingCents,
        projectedRatio: preflight.projectedRatio,
      },
    };
  }

  // 3.5. Pull repo context from the prior code_read stage (Phase 387).
  //      The real codeReadRealExecutor stores prompt-ready text in its
  //      outputDetail.repoContext. Best-effort: any Prisma blip leaves
  //      repoContext as null and the propose runs from instruction alone.
  let priorRepoContext: string | undefined = meta.repoContext;
  if (!priorRepoContext) {
    try {
      const priorRead = await prisma.pipelineStageRun.findFirst({
        where: { runId: ctx.runId, stageKind: "code_read", status: "succeeded" },
        orderBy: { completedAt: "desc" },
        select: { outputDetail: true },
      });
      const detail = priorRead?.outputDetail as { repoContext?: unknown } | null;
      if (detail && typeof detail.repoContext === "string" && detail.repoContext.length > 0) {
        priorRepoContext = detail.repoContext;
      }
    } catch { /* best-effort */ }
  }

  // 4. Build messages (pure — testable).
  const built = buildCodeProposeMessages({
    instruction: meta.instruction,
    repoRef: meta.repoRef,
    branchHint: meta.branchHint,
    repoContext: priorRepoContext,
  });

  // Workspace policy is resolved before a prompt leaves the service.
  const policyState = await loadWorkspaceAIProviderPolicyWithState(ctx.organizationId);
  if (policyState.storageState !== "ready") {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "ai.policy_unavailable",
        outcome: "blocked",
        entityRef: `coding_task:${ctx.runId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: { stageId: ctx.stageId, storageState: policyState.storageState },
      });
    } catch { /* best-effort */ }
    return {
      ok: false,
      error: "Workspace AI policy could not be verified. Try again shortly.",
      detail: { stageId: ctx.stageId, policyUnavailable: true },
    };
  }
  const workspacePolicy = resolveWorkspaceAIProviderPolicy({
    stored: policyState.policy,
    serviceEnabled: getAIProviderManager().status()
      .filter((provider) => provider.configured && provider.provider !== "mock")
      .map((provider) => provider.provider),
  });
  if (!workspacePolicy.enabled || !workspacePolicy.allowedProviders.includes("vercel_gateway")) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "ai.provider_not_approved",
        outcome: "blocked",
        entityRef: `coding_task:${ctx.runId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: { stageId: ctx.stageId, provider: "vercel_gateway", workspaceAiEnabled: workspacePolicy.enabled },
      });
    } catch { /* best-effort */ }
    return {
      ok: false,
      error: "This workspace's AI provider policy does not permit AI-generated code changes right now.",
      detail: { stageId: ctx.stageId, providerNotApproved: true },
    };
  }

  const gatewayResponses: AITextResponse[] = [];
  try {
    const manager = getAIProviderManager();
    const selectedGatewayModel = workspacePolicy.modelSelections.vercel_gateway ?? "service-default";
    const generateAttempt = async (prompt: string, system: string, phase: "initial" | "refinement") => {
      // Legacy machine/evaluation labels are not a verified billing member.
      // Never silently charge an owner on their behalf.
      if (ctx.triggeredBy.startsWith("api_key:") || ctx.triggeredBy.startsWith("system:")) throw new CodeProposalCallRefusal("billing_actor_unavailable");
      const loaded = await loadWorkspaceAIProviderPolicyWithState(ctx.organizationId).catch(() => null);
      if (!loaded || loaded.storageState !== "ready") throw new CodeProposalCallRefusal("policy_unavailable");
      const current = resolveWorkspaceAIProviderPolicy({ stored: loaded.policy,
        serviceEnabled: manager.status().filter(provider => provider.configured && provider.provider === "vercel_gateway" && manager.isServiceProviderAvailable(provider.provider)).map(provider => provider.provider) });
      if (!current.enabled || !current.allowedProviders.includes("vercel_gateway")
          || (current.modelSelections.vercel_gateway ?? "service-default") !== selectedGatewayModel) throw new CodeProposalCallRefusal("policy_changed");
      const dispatchModel = effectiveGatewayModel({ modelSelection: current.modelSelections.vercel_gateway,
        defaultModel: manager.status().find(row => row.provider === "vercel_gateway")?.defaultModel });
      if (!gatewayModelOutputBoundVerified(dispatchModel)) throw new CodeProposalCallRefusal("output_bound_unverified");
      const idempotencyKey = "coding_text_" + createHash("sha256").update(JSON.stringify([ctx.organizationId, ctx.stageRunId, phase])).digest("hex");
      boundedAIInput(prompt, system);
      const admitted = await admitAIText({ organizationId: ctx.organizationId, userId: ctx.triggeredBy,
        correlationId: ctx.correlationId, idempotencyKey, source: "coding_proposal" }, { prompt, system });
      if (!admitted.ok) throw new CodeProposalCallRefusal("reservation_refused");
      // The admitted manager performs one SDK attempt and durably links its
      // usage before returning. No ordinary retry/fallback or eager writer.
      const response = await manager.generateTextWithAdmission(prompt, {
        organizationId: ctx.organizationId, only: "vercel_gateway",
        allowedProviders: current.allowedProviders, modelSelections: current.modelSelections,
        fallbackOrder: current.fallbackOrder,
        model: dispatchModel,
        system, maxTokens: CODE_PROPOSE_MAX_TOKENS, temperature: 0.2, correlationId: ctx.correlationId,
      }, admitted.admission);
      gatewayResponses.push(response);
      return response;
    };
    const response = await generateAttempt(built.messages.map(message => message.content).join("\n\n"), built.system.map(block => block.text).join("\n"), "initial");
    const text = response.text;

    if (text.length === 0) {
      return {
        ok: false,
        error: "The selected AI model returned no usable patch text. No repository changes were made.",
        detail: {
          stageId: ctx.stageId,
          stopReason: response.finishReason,
          usage: response.usage,
        },
      };
    }

    // 5.5. Phase 390 — multi-turn refinement. Validate the diff locally;
    //      if it doesn't parse, give the AI ONE more shot with the parser
    //      error as feedback. Bounded to at most two Gateway calls
    //      calls per stage). Apply-mismatch retries only happen when bases
    //      are pre-sampled (future phase wires this); for now we validate
    //      parse only — the PR-open stage (Phase 388) catches apply errors
    //      with its own retry path.
    let finalText = text;
    let finalUsageInput = response.usage?.promptTokens ?? 0;
    let finalUsageOutput = response.usage?.completionTokens ?? 0;
    const finalCacheRead = 0;
    const finalCacheCreate = 0;
    let finalStopReason = response.finishReason;
    let resolvedModel = response.model;
    let refinementAttempts = 0;
    let refinementDecision: string | null = null;

    const initialValidation = validateProposal({ proposedPatchText: text, sampledBases: [] });
    const initialDecision = planRefinementAction({
      parseOk: initialValidation.parseOk,
      applyOk: initialValidation.applyOk,
      attemptCount: 0,
    });

    if (initialDecision.kind === "retry_parse" || initialDecision.kind === "retry_apply") {
      refinementAttempts = 1;
      refinementDecision = initialDecision.kind;
      try {
        const refinementBuilt = buildRefinementMessages({
          instruction: meta.instruction,
          repoRef: meta.repoRef,
          branchHint: meta.branchHint,
          repoContext: priorRepoContext,
          brokenPatchText: text,
          validation: initialValidation,
        });
        const refFinal = await generateAttempt(refinementBuilt.messages.map(message => message.content).join("\n\n"), refinementBuilt.system.map(block => block.text).join("\n"), "refinement");
        const refText = refFinal.text;

        // Add the refinement usage on top so the cost is honest.
        finalUsageInput += refFinal.usage?.promptTokens ?? 0;
        finalUsageOutput += refFinal.usage?.completionTokens ?? 0;
        finalStopReason = refFinal.finishReason;
        resolvedModel = refFinal.model;

        // Validate the refined output too — only swap if it's actually better.
        const refinedValidation = validateProposal({ proposedPatchText: refText, sampledBases: [] });
        if (refText.length > 0 && refinedValidation.parseOk) {
          finalText = refText;
          refinementDecision = "ship_refined";
        } else {
          refinementDecision = "refined_still_broken";
        }

        try {
          await recordAudit({
            organizationId: idFactory.organization(ctx.organizationId),
            actorKind: "system",
            action: "workforce.proposal_refined",
            outcome: refinementDecision === "ship_refined" ? "success" : "failure",
            entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
            correlationId: idFactory.correlation(ctx.correlationId),
            source: "live",
            detail: {
              initialReason: initialDecision.kind,
              refinedParseOk: refinedValidation.parseOk,
              finalDecision: refinementDecision,
              refinedInputTokens: refFinal.usage?.promptTokens ?? 0,
              refinedOutputTokens: refFinal.usage?.completionTokens ?? 0,
            },
          });
        } catch { /* best-effort */ }
      } catch (refErr) {
        // A failed second attempt cannot authorize shipping the invalid first patch.
        refinementDecision = "refinement_call_failed";
        try {
          await recordAudit({
            organizationId: idFactory.organization(ctx.organizationId),
            actorKind: "system",
            action: "workforce.proposal_gave_up",
            outcome: "failure",
            entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
            correlationId: idFactory.correlation(ctx.correlationId),
            source: "live",
            detail: {
              initialReason: initialDecision.kind,
              refinementError: refErr instanceof Error ? refErr.message : "unknown",
            },
          });
        } catch { /* best-effort */ }
        throw refErr;
      }
    }
    if (!validateProposal({ proposedPatchText: finalText, sampledBases: [] }).parseOk) {
      return { ok: false, error: "The AI response did not contain a valid patch. No repository changes were made.",
        detail: { stageId: ctx.stageId, completedAccountedAttempts: gatewayResponses.length, pendingSettlement: true } };
    }

    const firstLine = finalText.split("\n").find((l) => l.trim().length > 0) ?? "Patch proposed.";

    // 6. Verify durable accounting for each completed generation.
    // Each Gateway generation is recorded separately because its authoritative
    // cost is reconciled by generation id. Combining refinement calls would
    // make provider spend impossible to settle idempotently.
    // Accounting already happened inside each admitted manager call. Read its
    // durable evidence; never upsert the same generation a second time.
    const usageWrites = await Promise.all(gatewayResponses.map(async generation => {
      if (!generation.gatewayGenerationId) return { recorded: false, reason: "metering_identifier_missing" };
      const saved = await prisma.usageEvent.findUnique({ where: { externalUsageId: generation.gatewayGenerationId },
        select: { id: true, organizationId: true, provider: true, model: true, inputTokens: true, outputTokens: true } });
      if (!saved || saved.organizationId !== ctx.organizationId || saved.provider !== "vercel_gateway"
          || saved.model !== generation.model || saved.inputTokens !== generation.usage?.promptTokens
          || saved.outputTokens !== generation.usage?.completionTokens) return { recorded: false, reason: "accounted_usage_unavailable" };
      return { recorded: true, usageEventId: saved.id, pendingSettlement: true };
    }));
    const usageRecorded = usageWrites.every(write => write.recorded);
    const usageEventIds = usageWrites.flatMap(write => write.usageEventId ? [write.usageEventId] : []);
    const usageReason = usageWrites.find(write => !write.recorded)?.reason ?? null;

    if (!usageRecorded) {
      return {
        ok: false,
        error: "AI Gateway usage could not be reserved for settlement.",
        detail: { stageId: ctx.stageId, reason: usageReason },
      };
    }

    if (usageEventIds.length > 0) {
      try {
        await recordAudit({
          organizationId: idFactory.organization(ctx.organizationId),
          actorKind: "system",
          action: "billing.usage_recorded",
          outcome: "success",
          entityRef: `usage_event:${usageEventIds[0]}`,
          correlationId: idFactory.correlation(ctx.correlationId),
          source: "live",
          detail: {
            provider: "vercel_gateway",
            model: resolvedModel,
            usageEventIds,
            billingStatus: "pending_gateway_settlement",
            inputTokens: finalUsageInput,
            outputTokens: finalUsageOutput,
          },
        });
      } catch { /* best-effort */ }
    }

    return {
      ok: true,
      summary: firstLine.length > 200 ? firstLine.slice(0, 197) + "..." : firstLine,
      detail: {
        stageId: ctx.stageId,
        dryRun: false,
        model: resolvedModel,
        proposedPatchText: finalText,
        refinementAttempts,
        refinementDecision,
        usage: {
          input_tokens: finalUsageInput,
          output_tokens: finalUsageOutput,
          cache_read_input_tokens: finalCacheRead,
          cache_creation_input_tokens: finalCacheCreate,
        },
        cost: {
          totalCents: null,
          recorded: usageRecorded,
          reason: usageReason,
          pendingSettlement: usageWrites.some((write) => write.pendingSettlement),
        },
        creditPoolThreshold: preflight.threshold,
        stopReason: finalStopReason,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AI Gateway code proposal failed.",
      detail: { stageId: ctx.stageId, completedAccountedAttempts: gatewayResponses.length,
        ...(gatewayResponses.length ? { pendingSettlement: true } : {}),
        ...(err instanceof CodeProposalCallRefusal ? { callRefused: err.code } : {}) },
    };
  }
};
