/**
 * POST /api/workforce/ask-all — Phase 570.
 *
 * Operator asks one question; every client engineer answers in turn.
 * Sequential (same pacing as run-agi-all) so the provider rate limit
 * stays healthy and the breaker has a chance to settle if one engine
 * trips. Each answer persists as a normal engineer_qa row, keyed to
 * a single sweep correlation id stashed into the targetId so the
 * collective response is reconstructable:
 *
 *   targetId = `<engineerId>:askall_<sweepCorrelationId>`
 *
 * 303-redirects back to /dashboard/workforce/ask-all?sweep=<id> so
 * the operator lands on the unified view.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";
import type { AgentEngineer } from "@/lib/workforce/agentWorkforceRegistry";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HARD_DEADLINE_MS = 270_000;
const MAX_QUESTION_LEN = 1500;
const MAX_ANSWER_LEN = 4000;
const ENGINE_NAME_PREFIX = "engineer_qa";

function buildSystemPrompt(engineer: AgentEngineer): string {
  return [
    `You ARE the ${engineer.displayName} on the Axiom platform.`,
    `Your role: ${engineer.role}`,
    `Your department: ${engineer.department}`,
    `Speak in the first person, briefly (≤ 400 chars). If the question`,
    `is outside your specialty, say so plainly. Plain prose only.`,
  ].join("\n");
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const form = await req.formData();
  const rawQuestion = typeof form.get("question") === "string" ? String(form.get("question")) : "";
  const question = rawQuestion.trim().slice(0, MAX_QUESTION_LEN);
  if (!question) {
    return NextResponse.redirect(new URL("/dashboard/workforce/ask-all", req.url), 303);
  }

  const org = String(ctx.organizationId);
  const startedAt = Date.now();
  const sweepCorrelation = `askall_${Date.now().toString(36)}`;
  const correlationId = sweepCorrelation as CorrelationId;
  const engineers = AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client");

  const counts = { ai_generated: 0, fallback_rules: 0, error: 0, skipped_deadline: 0 };

  for (const engineer of engineers) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) {
      counts.skipped_deadline = engineers.length - (counts.ai_generated + counts.fallback_rules + counts.error);
      break;
    }

    const fetcher = makeInstrumentedFetcher({
      engineName: `${ENGINE_NAME_PREFIX}:${engineer.id}`,
      organizationId: org,
      timeoutMs: 30_000,
    });

    let answer = "";
    let outcome: "ai_generated" | "fallback_rules" | "error" = "fallback_rules";
    let modelHint: string | null = null;
    let errorMessage: string | null = null;
    try {
      const system = buildSystemPrompt(engineer);
      const prompt = `${system}\n\n---\n\nQuestion from the operator:\n${question}`;
      const result = await fetcher(prompt);
      answer = (result.text ?? "").trim().slice(0, MAX_ANSWER_LEN);
      if (!answer) {
        answer = `I'm the ${engineer.displayName} — the AI provider returned an empty response. Try the per-engineer ask page.`;
        outcome = "fallback_rules";
        errorMessage = "ai_empty_response";
      } else {
        outcome = "ai_generated";
        modelHint = result.modelHint;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      answer = `I'm the ${engineer.displayName} — couldn't answer right now (${msg}). Try again in a minute.`;
      outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
      errorMessage = msg;
    }

    const targetId = `${engineer.id}:${sweepCorrelation}`;
    try {
      await prisma.aiRationaleEnrichment.upsert({
        where: {
          organizationId_targetKind_targetId: {
            organizationId: org,
            targetKind: "engineer_qa",
            targetId,
          },
        },
        create: {
          organizationId: org,
          targetKind: "engineer_qa",
          targetId,
          narrative: answer,
          riskFactorsJson: [question] as unknown as string[],
          nextActionsJson: [] as unknown as string[],
          outcome,
          errorMessage,
          modelHint,
          engineVersion: "engineer-qa-askall-v1",
        },
        update: {
          narrative: answer,
          riskFactorsJson: [question] as unknown as string[],
          outcome,
          errorMessage,
          modelHint,
        },
      });
      counts[outcome] += 1;
    } catch (err) {
      console.warn("[ask-all] persist failed for", engineer.id, err instanceof Error ? err.message : err);
      counts.error += 1;
    }
  }

  // ─── Phase 573 — synthesis pass ─────────────────────────────────
  // After every engineer has answered, run ONE more Claude call that
  // reads the question + all the answers and produces a 2-3 sentence
  // synthesis (consensus, tensions, recommended next action). Stored
  // as a new targetKind so the existing AGI memory surfaces render
  // it without per-page conditionals.
  //
  // Synthesis runs ONLY when we have at least one ai_generated answer
  // — synthesizing fallback rows would just produce a meta-fallback
  // and waste tokens. Skipped synthesis is honest: the operator sees
  // the engineer answers without a misleading consensus summary.
  let synthesisOutcome: "ai_generated" | "fallback_rules" | "error" | "skipped" = "skipped";
  if (counts.ai_generated > 0 && Date.now() - startedAt < HARD_DEADLINE_MS) {
    try {
      const synthFetcher = makeInstrumentedFetcher({
        engineName: "workforce_synthesis",
        organizationId: org,
        timeoutMs: 30_000,
      });
      const answersForPrompt = await prisma.aiRationaleEnrichment.findMany({
        where: {
          organizationId: org,
          targetKind: "engineer_qa",
          targetId: { endsWith: `:${sweepCorrelation}` },
          outcome: "ai_generated",
        },
        select: { targetId: true, narrative: true },
      });
      const engineerLookup = new Map(engineers.map((e) => [e.id, e]));
      const blocks = answersForPrompt.map((row) => {
        const colon = row.targetId.indexOf(":");
        const eid = colon === -1 ? row.targetId : row.targetId.slice(0, colon);
        const e = engineerLookup.get(eid);
        return `## ${e?.displayName ?? eid} (${e?.department ?? "?"}):\n${row.narrative}`;
      });
      const synthPrompt = [
        `You are the workforce meta-coordinator. ${answersForPrompt.length} engineers just answered a single operator question.`,
        ``,
        `Read all the answers and produce ONE response with three short paragraphs:`,
        `  1. Consensus — what every engineer agrees on (or "no consensus" if they don't).`,
        `  2. Tensions — where engineers disagreed, and why.`,
        `  3. Recommended next action — the single most actionable step the operator should take, drawn from the answers.`,
        ``,
        `Plain prose, ≤ 700 chars total, no headings besides the bold labels Consensus: / Tensions: / Next action:. Refuse to invent — if engineers were vague, say so.`,
        ``,
        `---`,
        ``,
        `Operator question:`,
        question,
        ``,
        `---`,
        ``,
        `Engineer answers:`,
        ``,
        blocks.join("\n\n"),
      ].join("\n");

      const synthResult = await synthFetcher(synthPrompt);
      const synthText = (synthResult.text ?? "").trim().slice(0, 4000);
      if (synthText) {
        await prisma.aiRationaleEnrichment.upsert({
          where: {
            organizationId_targetKind_targetId: {
              organizationId: org,
              targetKind: "workforce_synthesis",
              targetId: sweepCorrelation,
            },
          },
          create: {
            organizationId: org,
            targetKind: "workforce_synthesis",
            targetId: sweepCorrelation,
            narrative: synthText,
            riskFactorsJson: [question] as unknown as string[],
            nextActionsJson: [] as unknown as string[],
            outcome: "ai_generated",
            errorMessage: null,
            modelHint: synthResult.modelHint,
            engineVersion: "workforce-synthesis-v1",
          },
          update: {
            narrative: synthText,
            riskFactorsJson: [question] as unknown as string[],
            outcome: "ai_generated",
            errorMessage: null,
            modelHint: synthResult.modelHint,
          },
        });
        synthesisOutcome = "ai_generated";
      } else {
        synthesisOutcome = "fallback_rules";
      }
    } catch (err) {
      console.warn("[ask-all] synthesis failed:", err instanceof Error ? err.message : err);
      synthesisOutcome = "error";
    }
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: counts.error > 0 ? "failure" : "success",
    entityRef: "workforce:all",
    correlationId,
    detail: {
      action: "engineer.ask_all",
      engineerCount: engineers.length,
      questionLen: question.length,
      sweepCorrelation,
      durationMs: Date.now() - startedAt,
      result: counts,
      synthesis: synthesisOutcome,
    },
  });

  return NextResponse.redirect(
    new URL(`/dashboard/workforce/ask-all?sweep=${encodeURIComponent(sweepCorrelation)}`, req.url),
    303,
  );
}
