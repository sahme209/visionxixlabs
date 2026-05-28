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
import { aiNativeVoterAsync } from "@/lib/releaseops/aiNativeAdvisorVoter";
import { sendSlackSignalBestEffort, type SlackRepo } from "@/lib/releaseops/slackNotificationResponder";

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
      ...(withAi ? { asyncVoters: [aiNativeVoterAsync] } : {}),
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
