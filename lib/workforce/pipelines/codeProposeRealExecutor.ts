/**
 * Real Anthropic-backed code_propose executor — Phase 380.
 *
 * Replaces the dry-run patch proposer with a real call to Claude. The
 * SDK is mandatory; no provider-neutral shims. Architecture:
 *
 *   - Model: claude-sonnet-4-6 (operator's choice for coding workloads —
 *     strong on code, fast turnaround, 64K max output tokens).
 *   - Thinking: adaptive (Claude decides when and how much to think;
 *     interleaved thinking is automatic, no beta header needed).
 *   - Effort: high (intelligence-sensitive coding work; Sonnet 4.6 does
 *     not support "max").
 *   - Streaming: required at this max_tokens — non-streaming hits the
 *     SDK's HTTP-timeout guard. We use stream.finalMessage() to collect
 *     the complete response without hand-rolling event handlers.
 *   - Prompt caching: cache_control: ephemeral on the system block.
 *     System prompt is frozen and identical across every coding task
 *     in the workspace; cache reads should fire on every request after
 *     the first.
 *
 * Graceful fallback: when ANTHROPIC_API_KEY is not set, the executor
 * returns the dry-run summary instead of failing. This keeps local
 * development and CI usable without a key. Operator can flip the live
 * path on by exporting the key — no code change.
 *
 * Typed exceptions: Anthropic.RateLimitError, Anthropic.APIError, etc.
 * No string matching on error messages.
 */

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  buildCodeProposeMessages,
  CODE_PROPOSE_SYSTEM_PROMPT,
} from "./buildCodeProposeMessages";
import type { StageExecutorFn, StageExecutorResult } from "./stageExecutorRegistry";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";
import { recordAIUsageEvent } from "@/lib/billing/recordAIUsageEvent";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { routeAITask } from "@/lib/ai/providerRouter";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { prisma } from "@/lib/db";
import { validateProposal } from "./validateProposal";
import { planRefinementAction } from "./planRefinementAction";
import { buildRefinementMessages } from "./buildRefinementMessages";
import { pickCostAwareModel } from "@/lib/ai/pickCostAwareModel";
import { resolveRunBudgetCap } from "./resolveRunBudgetCap";
import { loadBudgetConfig } from "./budgetConfigStore";

/** Route via the provider router (Phase 383) — single source of truth for which model the code-propose stage uses. */
const PROPOSE_ROUTE = routeAITask("code_propose");
const CODE_PROPOSE_DEFAULT_MODEL = PROPOSE_ROUTE.model;
const CODE_PROPOSE_EFFORT = PROPOSE_ROUTE.effort;

/** Cap on output tokens. Sonnet 4.6 maxes at 64K with streaming. */
const CODE_PROPOSE_MAX_TOKENS = 32_000;

/**
 * Anticipated cost of a single code_propose call at the default model
 * (claude-sonnet-4-6). Based on observed averages: ~10K input + ~3K
 * output → ~30¢ input + ~45¢ output ≈ 75¢. We round up to 100¢ to give
 * the cost-aware kernel (Phase 403) a conservative-but-honest estimate.
 */
const CODE_PROPOSE_ANTICIPATED_CENTS = 100;

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

function dryRunFallback(reason: string, ctx: { stageId: string }): StageExecutorResult {
  return {
    ok: true,
    summary: `[dry-run · ${reason}] would propose a minimal patch.`,
    detail: {
      stageId: ctx.stageId,
      dryRun: true,
      fallbackReason: reason,
      systemPromptBytes: CODE_PROPOSE_SYSTEM_PROMPT.length,
    },
  };
}

export const codeProposeRealExecutor: StageExecutorFn = async (ctx) => {
  // 1. ANTHROPIC_API_KEY guard — graceful dry-run fallback.
  if (!process.env.ANTHROPIC_API_KEY) {
    return dryRunFallback("no_api_key", ctx);
  }

  // 2. Validate run metadata. Coding tasks created via /api/workforce/coding-tasks
  //    populate { instruction, repoRef, branchHint } — see lib/workforce/pipelines/
  //    parseCodingTaskBody.ts. If a different caller starts the ai_coding pipeline
  //    without those fields, fall back to dry-run.
  const meta = readMetadata(ctx.runMetadata);
  if (!meta) {
    return dryRunFallback("missing_metadata", ctx);
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

  // Phase 403: cost-aware model picker. Looks at cumulative spend on
  // this run + resolved per-org cap to decide whether to downgrade the
  // default Sonnet model to Haiku before firing what would otherwise
  // push us over budget. Best-effort wrapped — any lookup failure
  // falls back to the default model.
  let modelToUse: string = CODE_PROPOSE_DEFAULT_MODEL;
  let modelDecisionForAudit: ReturnType<typeof pickCostAwareModel> | null = null;
  try {
    const spentAgg = await prisma.pipelineStageRun.aggregate({
      where: { runId: ctx.runId },
      _sum: { costCents: true },
    });
    const orgConfig = await loadBudgetConfig(ctx.organizationId);
    const cap = resolveRunBudgetCap({
      pipelineId: ctx.pipelineId,
      runMetadata: ctx.runMetadata,
      orgConfig,
    });
    modelDecisionForAudit = pickCostAwareModel({
      defaultModel: CODE_PROPOSE_DEFAULT_MODEL,
      spentCents: spentAgg._sum.costCents ?? 0,
      capCents: cap.maxCents,
      anticipatedCostCentsAtDefault: CODE_PROPOSE_ANTICIPATED_CENTS,
    });
    modelToUse = modelDecisionForAudit.model;
    if (modelDecisionForAudit.kind === "downgrade_to_cheaper") {
      try {
        await recordAudit({
          organizationId: idFactory.organization(ctx.organizationId),
          actorKind: "system",
          action: "workforce.model_downgraded",
          outcome: "success",
          entityRef: `pipeline_stage_run:${ctx.stageRunId}`,
          correlationId: idFactory.correlation(ctx.correlationId),
          source: "live",
          detail: {
            stageId: ctx.stageId,
            defaultModel: CODE_PROPOSE_DEFAULT_MODEL,
            chosenModel: modelToUse,
            spentCents: spentAgg._sum.costCents ?? 0,
            capCents: cap.maxCents,
            anticipatedCostCentsAtDefault: CODE_PROPOSE_ANTICIPATED_CENTS,
            estimatedCostCentsAtChosen: modelDecisionForAudit.estimatedCostCents,
            savedCents: modelDecisionForAudit.savedCents,
            rationale: modelDecisionForAudit.rationale,
            capSource: cap.source,
          },
        });
      } catch { /* best-effort */ }
    }
  } catch { /* fail-open with default model */ }

  // 3.7. Workspace AI provider policy gate. This executor calls Anthropic
  // directly with the mandatory SDK (see file header — no provider-neutral
  // shim), so unlike call sites routed through the AIProviderManager, no
  // upstream layer enforces the workspace's own enabled/allowed-provider
  // policy for it. A workspace that disables AI, or disallows Anthropic
  // specifically, must be able to stop this stage before it writes code
  // changes against the tenant's repo. A policy read failure fails closed
  // — an unreadable policy is never treated as "no restriction."
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
  if (!workspacePolicy.enabled || !workspacePolicy.allowedProviders.includes("anthropic")) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorKind: "system",
        action: "ai.provider_not_approved",
        outcome: "blocked",
        entityRef: `coding_task:${ctx.runId}`,
        correlationId: idFactory.correlation(ctx.correlationId),
        source: "live",
        detail: { stageId: ctx.stageId, provider: "anthropic", workspaceAiEnabled: workspacePolicy.enabled },
      });
    } catch { /* best-effort */ }
    return {
      ok: false,
      error: "This workspace's AI provider policy does not permit AI-generated code changes right now.",
      detail: { stageId: ctx.stageId, providerNotApproved: true },
    };
  }

  const client = new Anthropic();

  try {
    // 4. Stream — required at this max_tokens to dodge the SDK timeout guard.
    //    finalMessage() resolves with the complete Message; no manual event wiring.
    const stream = client.messages.stream({
      model: modelToUse,
      max_tokens: CODE_PROPOSE_MAX_TOKENS,
      system: built.system as unknown as Anthropic.TextBlockParam[],
      messages: built.messages as unknown as Anthropic.MessageParam[],
      thinking: { type: "adaptive" },
      // CODE_PROPOSE_EFFORT comes from the AI router (Phase 383). The router's
      // AIEffort union includes "xhigh" (Opus 4.7 only) which the SDK doesn't
      // accept on Sonnet — cast narrowly since this route is always "high".
      output_config: { effort: CODE_PROPOSE_EFFORT as "low" | "medium" | "high" | "max" },
    });
    const final = await stream.finalMessage();

    // 5. Pluck the first text block. Thinking blocks may precede it; ignore them.
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (text.length === 0) {
      return {
        ok: false,
        error: "Empty text response from Claude (only thinking blocks). Try increasing max_tokens or check stop_reason.",
        detail: {
          stageId: ctx.stageId,
          stopReason: final.stop_reason ?? "unknown",
          usage: final.usage,
        },
      };
    }

    // 5.5. Phase 390 — multi-turn refinement. Validate the diff locally;
    //      if it doesn't parse, give the AI ONE more shot with the parser
    //      error as feedback. Bounded by Vercel's 60s ceiling (≤2 Anthropic
    //      calls per stage). Apply-mismatch retries only happen when bases
    //      are pre-sampled (future phase wires this); for now we validate
    //      parse only — the PR-open stage (Phase 388) catches apply errors
    //      with its own retry path.
    let finalText = text;
    let finalUsageInput = final.usage.input_tokens;
    let finalUsageOutput = final.usage.output_tokens;
    let finalCacheRead = final.usage.cache_read_input_tokens ?? 0;
    let finalCacheCreate = final.usage.cache_creation_input_tokens ?? 0;
    let finalStopReason = final.stop_reason ?? "unknown";
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
        const refStream = client.messages.stream({
          model: modelToUse,
          max_tokens: CODE_PROPOSE_MAX_TOKENS,
          system: refinementBuilt.system as unknown as Anthropic.TextBlockParam[],
          messages: refinementBuilt.messages as unknown as Anthropic.MessageParam[],
          thinking: { type: "adaptive" },
          output_config: { effort: CODE_PROPOSE_EFFORT as "low" | "medium" | "high" | "max" },
        });
        const refFinal = await refStream.finalMessage();
        const refText = refFinal.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        // Add the refinement usage on top so the cost is honest.
        finalUsageInput += refFinal.usage.input_tokens;
        finalUsageOutput += refFinal.usage.output_tokens;
        finalCacheRead += refFinal.usage.cache_read_input_tokens ?? 0;
        finalCacheCreate += refFinal.usage.cache_creation_input_tokens ?? 0;
        finalStopReason = refFinal.stop_reason ?? "unknown";

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
              refinedInputTokens: refFinal.usage.input_tokens,
              refinedOutputTokens: refFinal.usage.output_tokens,
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
      provider: "anthropic",
      model: modelToUse,
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
            provider: "anthropic",
            model: modelToUse,
            costCents: usageWrite.cost?.totalCents ?? 0,
            inputTokens: final.usage.input_tokens,
            outputTokens: final.usage.output_tokens,
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
        model: modelToUse,
        defaultModel: CODE_PROPOSE_DEFAULT_MODEL,
        modelDecisionKind: modelDecisionForAudit?.kind ?? "use_default",
        modelDecisionRationale: modelDecisionForAudit?.rationale,
        effort: CODE_PROPOSE_EFFORT,
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
    // 6. Typed exception classes — never string-match the message.
    if (err instanceof Anthropic.AuthenticationError) {
      // Invalid key isn't a transient failure — fall back to dry-run so the
      // pipeline run still completes, with a clear reason recorded.
      return dryRunFallback("invalid_api_key", ctx);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        error: `Anthropic rate-limited the request. Retry-After: ${err.headers?.get("retry-after") ?? "unknown"}.`,
        detail: { stageId: ctx.stageId, status: err.status ?? 429 },
      };
    }
    if (err instanceof Anthropic.APIError) {
      return {
        ok: false,
        error: `Anthropic API error ${err.status ?? "unknown"}: ${err.message}`,
        detail: { stageId: ctx.stageId, status: err.status ?? null },
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown propose error.",
      detail: { stageId: ctx.stageId },
    };
  }
};
