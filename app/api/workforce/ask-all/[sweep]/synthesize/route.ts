/**
 * POST /api/workforce/ask-all/[sweep]/synthesize — Phase 574.
 *
 * Backfill a Phase 573 synthesis for a past sweep that doesn't have
 * one. Reads every ai_generated engineer_qa row tied to the sweep,
 * runs one Claude call through the canonical instrumented fetcher
 * (workforce_synthesis engine — circuit breaker + AiCallLog + Phase
 * 538 watchdog all engage), upserts the workforce_synthesis row.
 *
 * Idempotent: re-running on a sweep that already has a synthesis
 * just refreshes it with the latest model output.
 *
 * 303-redirects back to the sweep view so the operator sees the
 * freshly minted synthesis at the top of the ask-all page.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sweep: string }> },
) {
  const ctx = await requireContext();
  const { sweep: sweepRaw } = await params;
  const sweepId = decodeURIComponent(sweepRaw).trim();
  if (!sweepId) {
    return NextResponse.json({ error: "missing sweep" }, { status: 400 });
  }

  const org = String(ctx.organizationId);
  const correlationId = `synth_${sweepId}_${Date.now().toString(36)}` as CorrelationId;

  // Load every ai_generated engineer answer for this sweep.
  const answers = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: org,
      targetKind: "engineer_qa",
      targetId: { endsWith: `:${sweepId}` },
      outcome: "ai_generated",
    },
    select: { targetId: true, narrative: true, riskFactorsJson: true },
  }).catch(() => []);

  if (answers.length === 0) {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "engineer.action_attempted",
      outcome: "blocked",
      entityRef: `workforce:sweep:${sweepId}`,
      correlationId,
      detail: { action: "engineer.synthesize_sweep", sweepId, reason: "no_ai_generated_answers" },
    });
    return NextResponse.redirect(
      new URL(`/dashboard/workforce/ask-all?sweep=${encodeURIComponent(sweepId)}`, req.url),
      303,
    );
  }

  // Original question rides on every engineer_qa row's riskFactorsJson[0];
  // pick the first one we see.
  const question = (() => {
    for (const a of answers) {
      if (Array.isArray(a.riskFactorsJson) && typeof a.riskFactorsJson[0] === "string") {
        return a.riskFactorsJson[0];
      }
    }
    return "";
  })();

  const engineerLookup = new Map(AGENT_WORKFORCE_REGISTRY.map((e) => [e.id, e]));
  const blocks = answers.map((row) => {
    const colon = row.targetId.indexOf(":");
    const eid = colon === -1 ? row.targetId : row.targetId.slice(0, colon);
    const e = engineerLookup.get(eid);
    return `## ${e?.displayName ?? eid} (${e?.department ?? "?"}):\n${row.narrative}`;
  });

  const synthPrompt = [
    `You are the workforce meta-coordinator. ${answers.length} engineers answered a single operator question.`,
    ``,
    `Read all the answers and produce ONE response with three short paragraphs:`,
    `  1. Consensus — what every engineer agrees on (or "no consensus" if they don't).`,
    `  2. Tensions — where engineers disagreed, and why.`,
    `  3. Recommended next action — the single most actionable step the operator should take.`,
    ``,
    `Plain prose, ≤ 700 chars total, no headings besides the bold labels Consensus: / Tensions: / Next action:. Refuse to invent — if engineers were vague, say so.`,
    ``,
    `---`,
    ``,
    `Operator question:`,
    question || "(question not recorded)",
    ``,
    `---`,
    ``,
    `Engineer answers:`,
    ``,
    blocks.join("\n\n"),
  ].join("\n");

  let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
  let errorMessage: string | null = null;
  let modelHint: string | null = null;
  let synthText = `Synthesis unavailable — ${answers.length} engineer answers exist for this sweep but the AI couldn't synthesize them right now.`;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "workforce_synthesis",
      organizationId: org,
      timeoutMs: 30_000,
    });
    const result = await fetcher(synthPrompt);
    const text = (result.text ?? "").trim().slice(0, 4000);
    if (text) {
      synthText = text;
      modelHint = result.modelHint;
      outcome = "ai_generated";
    } else {
      outcome = "fallback_rules";
      errorMessage = "ai_empty_response";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
    errorMessage = msg;
  }

  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId: org,
          targetKind: "workforce_synthesis",
          targetId: sweepId,
        },
      },
      create: {
        organizationId: org,
        targetKind: "workforce_synthesis",
        targetId: sweepId,
        narrative: synthText,
        riskFactorsJson: [question] as unknown as string[],
        nextActionsJson: [] as unknown as string[],
        outcome,
        errorMessage,
        modelHint,
        engineVersion: "workforce-synthesis-v1",
      },
      update: {
        narrative: synthText,
        riskFactorsJson: [question] as unknown as string[],
        outcome,
        errorMessage,
        modelHint,
      },
    });
  } catch (err) {
    console.warn("[synthesize sweep] persist failed:", err instanceof Error ? err.message : err);
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: outcome === "error" ? "failure" : "success",
    entityRef: `workforce:sweep:${sweepId}`,
    correlationId,
    detail: {
      action: "engineer.synthesize_sweep",
      sweepId,
      answerCount: answers.length,
      synthesis: outcome,
    },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/workforce/ask-all?sweep=${encodeURIComponent(sweepId)}`, req.url),
    303,
  );
}
