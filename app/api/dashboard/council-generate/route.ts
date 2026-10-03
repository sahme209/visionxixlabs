/**
 * POST /api/dashboard/council-generate — Phase 514.
 * Body: { releaseId, withAi? }
 *
 * Runs the multi-voter advisor council on the given release. Reuses
 * the existing advisor input aggregator. Phase 516 adds an optional
 * `withAi: true` flag that includes the AI-native voter (Claude API)
 * alongside the three rule-based voters.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildCouncilGenerateResponse,
  type AdvisorCouncilRepo,
} from "@/lib/releaseops/advisorCouncilResponder";
import {
  aggregateAdvisorInputs,
  type AdvisorInputsRepo,
} from "@/lib/releaseops/advisorInputsAggregator";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { makeAiNativeVoterAsync } from "@/lib/releaseops/aiNativeAdvisorVoter";
import { sendSlackSignalBestEffort, type SlackRepo } from "@/lib/releaseops/slackNotificationResponder";
import {
  enrichDecisionBestEffort,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { releaseId?: unknown; withAi?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  if (!releaseId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId, withAi? }." },
      { status: 400 },
    );
  }
  const withAi = body.withAi === true;

  const agg = await aggregateAdvisorInputs(
    prisma as unknown as AdvisorInputsRepo,
    { organizationId: ctx.organizationId, releaseId },
  );
  if (!agg.ok) {
    const status = agg.error === "release_not_found" ? 404 : 403;
    return NextResponse.json({ ok: false, error: agg.error }, { status });
  }

  const r = await buildCouncilGenerateResponse(
    prisma as unknown as AdvisorCouncilRepo,
    {
      organizationId: ctx.organizationId,
      releaseId,
      engineInputs: agg.inputs,
      ...(withAi ? { asyncVoters: [makeAiNativeVoterAsync(ctx.organizationId)] } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "advisor_council.generate",
      subjectKind: "release",
      subjectId: releaseId,
      summary: `Council${withAi ? " (with AI)" : ""} ${r.body.data.decision.consensusKind} · ${r.body.data.decision.agreementScore}% agreement · ${r.body.data.decision.voterCount} voters`,
      actorUserId: ctx.userId ?? null,
    });

    // Phase 518 — Auto-enrich every new decision with an AI rationale.
    // Best-effort: never blocks the council generate response.
    await enrichDecisionBestEffort(
      prisma as unknown as EnrichmentRepo,
      {
        organizationId: ctx.organizationId,
        decisionId: r.body.data.decision.id,
        decision: {
          engineVersion: r.body.data.decision.engineVersion,
          generatedAtIso: r.body.data.decision.generatedAtIso,
          // CouncilView's consensusKind can be "unknown" (defensive on
          // legacy rows); narrow to the engine's closed-union for enrich.
          consensusKind: r.body.data.decision.consensusKind === "unknown" ? "proceed" : r.body.data.decision.consensusKind,
          agreementScore: r.body.data.decision.agreementScore,
          title: r.body.data.decision.title,
          rationale: r.body.data.decision.rationale,
          votes: r.body.data.decision.votes,
          voterCount: r.body.data.decision.voterCount,
        },
        inputs: agg.inputs,
        // Only call live AI when the operator asked for it on this run;
        // otherwise persist a deterministic fallback (cheap).
        fetcher: withAi ? makeLiveRationaleFetcher({ engineName: "council_rationale", organizationId: ctx.organizationId }) : null,
      },
    );

    // Phase 517 — Slack notify on critical-severity consensus.
    const critical = r.body.data.decision.consensusKind === "block_deploy"
      || r.body.data.decision.consensusKind === "rollback";
    if (critical) {
      const dashboardBase = process.env.NEXTAUTH_URL ?? "";
      await sendSlackSignalBestEffort(
        prisma as unknown as SlackRepo,
        {
          organizationId: ctx.organizationId,
          signal: {
            kind: "council_critical",
            title: r.body.data.decision.title,
            summary: `Consensus: ${r.body.data.decision.consensusKind} · ${r.body.data.decision.agreementScore}% agreement · ${r.body.data.decision.voterCount} voters`,
            detail: r.body.data.decision.rationale.slice(0, 280),
            severity: "critical",
            subjectKind: "release",
            subjectId: releaseId,
            ...(dashboardBase ? { dashboardUrl: `${dashboardBase}/dashboard/advisor-council` } : {}),
          },
        },
        // Use the global fetch; cast satisfies the structural SlackFetcher type.
        ((url, init) => fetch(url, init)) as Parameters<typeof sendSlackSignalBestEffort>[2],
      );
    }
  }
  return NextResponse.json(r.body, { status: r.status });
}
