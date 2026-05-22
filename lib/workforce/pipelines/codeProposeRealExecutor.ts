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

/** Operator-chosen model. Per the user request, Sonnet 4.6 for the coding loop. */
const CODE_PROPOSE_MODEL = "claude-sonnet-4-6";

/** Cap on output tokens. Sonnet 4.6 maxes at 64K with streaming. */
const CODE_PROPOSE_MAX_TOKENS = 32_000;

/** Effort level — high for intelligence-sensitive coding work. */
const CODE_PROPOSE_EFFORT = "high" as const;

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
  const preflight = await checkWorkspaceAICredits(ctx.organizationId);
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

  // 4. Build messages (pure — testable).
  const built = buildCodeProposeMessages({
    instruction: meta.instruction,
    repoRef: meta.repoRef,
    branchHint: meta.branchHint,
    repoContext: meta.repoContext,
  });

  const client = new Anthropic();

  try {
    // 4. Stream — required at this max_tokens to dodge the SDK timeout guard.
    //    finalMessage() resolves with the complete Message; no manual event wiring.
    const stream = client.messages.stream({
      model: CODE_PROPOSE_MODEL,
      max_tokens: CODE_PROPOSE_MAX_TOKENS,
      system: built.system as unknown as Anthropic.TextBlockParam[],
      messages: built.messages as unknown as Anthropic.MessageParam[],
      thinking: { type: "adaptive" },
      output_config: { effort: CODE_PROPOSE_EFFORT },
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

    const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "Patch proposed.";

    // 6. Cost attribution — Phase 382. Write a UsageEvent so the meter
    //    dashboards reflect this invocation. Best-effort; never blocks
    //    the response on a Prisma failure.
    const usageWrite = await recordAIUsageEvent({
      organizationId: ctx.organizationId,
      provider: "anthropic",
      model: CODE_PROPOSE_MODEL,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cachedReadTokens: final.usage.cache_read_input_tokens ?? 0,
      triggeredBy: ctx.triggeredBy,
      correlationId: ctx.correlationId,
      metadata: {
        stage: "code_propose",
        stageRunId: ctx.stageRunId,
        runId: ctx.runId,
        pipelineId: ctx.pipelineId,
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
            model: CODE_PROPOSE_MODEL,
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
        model: CODE_PROPOSE_MODEL,
        effort: CODE_PROPOSE_EFFORT,
        proposedPatchText: text,
        usage: {
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          cache_read_input_tokens: final.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: final.usage.cache_creation_input_tokens ?? 0,
        },
        cost: {
          totalCents: usageWrite.cost?.totalCents ?? null,
          recorded: usageWrite.recorded,
          reason: usageWrite.reason ?? null,
        },
        creditPoolThreshold: preflight.threshold,
        stopReason: final.stop_reason ?? "unknown",
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
