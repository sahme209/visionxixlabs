/**
 * Real Vercel AI Gateway-backed code_propose executor.
 *
 * Repository proposals use the workspace-selected Gateway model and fail
 * closed when Gateway, policy, metadata, or credits are unavailable.
 * No direct model-provider credential is accepted by this workflow.
 */

import "server-only";

import { buildCodeProposeMessages } from "./buildCodeProposeMessages";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { recordAIUsageEvent } from "@/lib/billing/recordAIUsageEvent";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { prisma } from "@/lib/db";
import { validateProposal } from "./validateProposal";
import { planRefinementAction } from "./planRefinementAction";
import { buildRefinementMessages } from "./buildRefinementMessages";

/** Keep responses bounded even when the selected Gateway model supports more. */
const CODE_PROPOSE_MAX_TOKENS = 32_000;

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

  try {
    const manager = getAIProviderManager();
    const selectedGatewayModel = workspacePolicy.modelSelections.vercel_gateway;
    const response = await manager.generateText(built.messages.map((message) => message.content).join("\n\n"), {
      organizationId: ctx.organizationId,
      only: "vercel_gateway",
      allowedProviders: workspacePolicy.allowedProviders,
      modelSelections: workspacePolicy.modelSelections,
      model: selectedGatewayModel === "service-default" ? undefined : selectedGatewayModel,
      system: built.system.map((block) => block.text).join("\n"),
      maxTokens: CODE_PROPOSE_MAX_TOKENS,
      temperature: 0.2,
      correlationId: ctx.correlationId,
    });
    const text = response.text;

    if (text.length === 0) {
      return {
        ok: false,
        error: "Empty text response from Claude (only thinking blocks). Try increasing max_tokens or check stop_reason.",
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
        const refFinal = await manager.generateText(refinementBuilt.messages.map((message) => message.content).join("\n\n"), {
          organizationId: ctx.organizationId,
          only: "vercel_gateway",
          allowedProviders: workspacePolicy.allowedProviders,
          modelSelections: workspacePolicy.modelSelections,
          model: selectedGatewayModel === "service-default" ? undefined : selectedGatewayModel,
          system: refinementBuilt.system.map((block) => block.text).join("\n"),
          maxTokens: CODE_PROPOSE_MAX_TOKENS,
          temperature: 0.2,
          correlationId: ctx.correlationId,
        });
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
        // Refinement call itself failed (rate limit, etc.). Ship the original.
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
      }
    }

    const firstLine = finalText.split("\n").find((l) => l.trim().length > 0) ?? "Patch proposed.";

    // 6. Cost attribution — Phase 382. Write a UsageEvent so the meter
    //    dashboards reflect this invocation (now includes refinement
    //    tokens when the second call fired).
    const usageWrite = await recordAIUsageEvent({
      organizationId: ctx.organizationId,
      provider: "vercel_gateway",
      model: resolvedModel,
      inputTokens: finalUsageInput,
      outputTokens: finalUsageOutput,
      cachedReadTokens: finalCacheRead,
      triggeredBy: ctx.triggeredBy,
      correlationId: ctx.correlationId,
      metadata: {
        stage: "code_propose",
        stageRunId: ctx.stageRunId,
        runId: ctx.runId,
        pipelineId: ctx.pipelineId,
        refinementAttempts,
        refinementDecision,
      },
    });

    if (usageWrite.recorded) {
      try {
        await recordAudit({
          organizationId: idFactory.organization(ctx.organizationId),
          actorKind: "system",
          action: "billing.usage_recorded",
          outcome: "success",
          entityRef: `usage_event:${usageWrite.usageEventId}`,
          correlationId: idFactory.correlation(ctx.correlationId),
          source: "live",
          detail: {
            provider: "vercel_gateway",
            model: resolvedModel,
            costCents: usageWrite.cost?.totalCents ?? 0,
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
          totalCents: usageWrite.cost?.totalCents ?? null,
          recorded: usageWrite.recorded,
          reason: usageWrite.reason ?? null,
        },
        creditPoolThreshold: preflight.threshold,
        stopReason: finalStopReason,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AI Gateway code proposal failed.",
      detail: { stageId: ctx.stageId },
    };
  }
};
