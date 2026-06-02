/**
 * POST /api/workforce/ask-all/synthesize-all — Phase 575.
 *
 * Bulk backfill: walks every past ask-all sweep in the workspace
 * that doesn't already have a workforce_synthesis row, runs the
 * Phase 573 synthesis flow for each, and 303-redirects back to the
 * ask-all surface.
 *
 * Sequential by design — sweeps that need synthesis already had
 * their per-engineer fan-out chew tokens. The synthesis pass is one
 * more Claude call per sweep, so we pace them and respect a hard
 * deadline. Skipped sweeps (deadline exceeded, no ai_generated
 * answers) get counted honestly in the audit row.
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
export const maxDuration = 300;

const HARD_DEADLINE_MS = 270_000;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const startedAt = Date.now();
  const correlationId = `synthall_${Date.now().toString(36)}` as CorrelationId;
  const counts = { synthesized: 0, skipped_no_answers: 0, errored: 0, already_present: 0, skipped_deadline: 0 };

  // Discover past sweeps the same way the ask-all page does — bulk
  // sample of askall-tagged rows, fold by sweep correlation.
  const sampleRows = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: org,
      targetKind: "engineer_qa",
      targetId: { contains: ":askall_" },
    },
    orderBy: { generatedAt: "desc" },
    take: 500,
    select: { targetId: true },
  }).catch(() => [] as Array<{ targetId: string }>);

  const sweepIds = new Set<string>();
  for (const r of sampleRows) {
    const colon = r.targetId.indexOf(":");
    if (colon === -1) continue;
    sweepIds.add(r.targetId.slice(colon + 1));
  }

  if (sweepIds.size === 0) {
    return NextResponse.redirect(new URL("/dashboard/workforce/ask-all", req.url), 303);
  }

  // Existing synthesis rows — skip these.
  const existingSynth = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: org,
      targetKind: "workforce_synthesis",
      targetId: { in: Array.from(sweepIds) },
    },
    select: { targetId: true },
  }).catch(() => [] as Array<{ targetId: string }>);
  const existingSet = new Set(existingSynth.map((r) => r.targetId));
  counts.already_present = existingSet.size;

  const missing = Array.from(sweepIds).filter((id) => !existingSet.has(id));
  const engineerLookup = new Map(AGENT_WORKFORCE_REGISTRY.map((e) => [e.id, e]));

  for (const sweepId of missing) {
    if (Date.now() - startedAt > HARD_DEADLINE_MS) {
      counts.skipped_deadline = missing.length - (counts.synthesized + counts.skipped_no_answers + counts.errored);
      break;
    }

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
      counts.skipped_no_answers += 1;
      continue;
    }

    const question = (() => {
      for (const a of answers) {
        if (Array.isArray(a.riskFactorsJson) && typeof a.riskFactorsJson[0] === "string") {
          return a.riskFactorsJson[0];
        }
      }
      return "";
    })();

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
      `Plain prose, ≤ 700 chars total. Bold labels Consensus: / Tensions: / Next action:. Refuse to invent.`,
      ``,
      `Operator question:`,
      question || "(question not recorded)",
      ``,
      `Engineer answers:`,
      blocks.join("\n\n"),
    ].join("\n");

    try {
      const fetcher = makeInstrumentedFetcher({
        engineName: "workforce_synthesis",
        organizationId: org,
        timeoutMs: 30_000,
      });
      const result = await fetcher(synthPrompt);
      const text = (result.text ?? "").trim().slice(0, 4000);
      if (!text) {
        await prisma.aiRationaleEnrichment.upsert({
          where: { organizationId_targetKind_targetId: { organizationId: org, targetKind: "workforce_synthesis", targetId: sweepId } },
          create: {
            organizationId: org, targetKind: "workforce_synthesis", targetId: sweepId,
            narrative: `Synthesis unavailable — ${answers.length} engineer answers exist for this sweep but the AI returned no text.`,
            riskFactorsJson: [question] as unknown as string[], nextActionsJson: [] as unknown as string[],
            outcome: "fallback_rules", errorMessage: "ai_empty_response", modelHint: null,
            engineVersion: "workforce-synthesis-v1",
          },
          update: {
            narrative: `Synthesis unavailable — ${answers.length} engineer answers exist but the AI returned no text.`,
            outcome: "fallback_rules", errorMessage: "ai_empty_response", modelHint: null,
          },
        });
        counts.errored += 1;
        continue;
      }
      await prisma.aiRationaleEnrichment.upsert({
        where: { organizationId_targetKind_targetId: { organizationId: org, targetKind: "workforce_synthesis", targetId: sweepId } },
        create: {
          organizationId: org, targetKind: "workforce_synthesis", targetId: sweepId,
          narrative: text,
          riskFactorsJson: [question] as unknown as string[], nextActionsJson: [] as unknown as string[],
          outcome: "ai_generated", errorMessage: null, modelHint: result.modelHint,
          engineVersion: "workforce-synthesis-v1",
        },
        update: {
          narrative: text,
          riskFactorsJson: [question] as unknown as string[],
          outcome: "ai_generated", errorMessage: null, modelHint: result.modelHint,
        },
      });
      counts.synthesized += 1;
    } catch (err) {
      console.warn("[synthesize-all] sweep", sweepId, "failed:", err instanceof Error ? err.message : err);
      counts.errored += 1;
    }
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: counts.errored > 0 ? "failure" : "success",
    entityRef: "workforce:askall:bulk",
    correlationId,
    detail: {
      action: "engineer.synthesize_all_sweeps",
      sweepsExamined: sweepIds.size,
      missingCount: missing.length,
      durationMs: Date.now() - startedAt,
      result: counts,
    },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/ask-all", req.url), 303);
}
