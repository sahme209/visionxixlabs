/**
 * GET /api/cron/releaseops-autonomous-tick — Phase 513.
 *
 * Vercel cron triggers this hourly. The tick orchestrator scans
 * every org and autonomously runs the four AGI engines (advisor,
 * triage, remediation, policy proposal) for subjects that lack a
 * recent run.
 *
 * Auth: Vercel cron sends a header with the deployment-internal
 * cron secret. We trust the request when CRON_SECRET matches.
 * Outside that, the endpoint is unauthenticated for ops tools to
 * trigger manually with the secret in the query string.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  runAutonomousTick,
  type AutonomousTickRepo,
  type EngineRunners,
} from "@/lib/releaseops/autonomousTickResponder";

// Engine runners.
import {
  buildAdvisorGenerateResponse,
  type AdvisorRepo,
} from "@/lib/releaseops/advisorRecommendationResponder";
import {
  aggregateAdvisorInputs,
  type AdvisorInputsRepo,
} from "@/lib/releaseops/advisorInputsAggregator";
import {
  buildTriageGenerateResponse,
  type IncidentTriageRepo,
} from "@/lib/releaseops/incidentTriageResponder";
import {
  aggregateIncidentTriageInputs,
  type IncidentTriageAggregateRepo,
} from "@/lib/releaseops/incidentTriageAggregator";
import {
  buildRemediationGenerateResponse,
  type RemediationRepo,
} from "@/lib/releaseops/remediationProposalResponder";
import {
  aggregateRemediationInputs,
  type RemediationAggregateRepo,
} from "@/lib/releaseops/remediationProposalAggregator";
import {
  buildProposalGenerateResponse,
  type PolicyProposalRepo as PolicyResponderRepo,
} from "@/lib/releaseops/policyProposalResponder";
import {
  aggregatePolicyProposalInputs,
  type PolicyProposalRepo as PolicyAggregatorRepo,
} from "@/lib/releaseops/policyProposalAggregator";

// Phase 526 — Proactive suggestion runner.
import {
  buildSuggestionGenerateResponse,
  type ProactiveSuggestionRepo,
} from "@/lib/releaseops/proactiveAgiSuggestionResponder";
import type {
  SuggestionContextEntry,
  SuggestionContextSummary,
} from "@/lib/releaseops/proactiveAgiSuggestionEngine";
import {
  buildAgiMemoryListResponse,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import {
  buildMemorySummaryTimelineResponse,
  type MemorySummaryRepo,
} from "@/lib/releaseops/aiMemorySummaryResponder";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 5-minute max — Vercel hobby/pro default is 10s, but cron + serverless
// allows longer. Set explicit max so the orchestrator can scan many orgs.
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel cron sends "Authorization: Bearer <secret>".
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  // Also accept ?secret= for manual ops invocation.
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const runners: EngineRunners = {
    async runAdvisor(orgId, releaseId) {
      const agg = await aggregateAdvisorInputs(
        prisma as unknown as AdvisorInputsRepo,
        { organizationId: orgId, releaseId },
      );
      if (!agg.ok) return { ok: false, reason: agg.error };
      const r = await buildAdvisorGenerateResponse(
        prisma as unknown as AdvisorRepo,
        { organizationId: orgId, releaseId, engineInputs: agg.inputs },
      );
      return r.body.ok ? { ok: true } : { ok: false, reason: r.body.error };
    },
    async runTriage(orgId, incidentId) {
      const agg = await aggregateIncidentTriageInputs(
        prisma as unknown as IncidentTriageAggregateRepo,
        { organizationId: orgId, incidentId },
      );
      if (!agg.ok) return { ok: false, reason: agg.error };
      const r = await buildTriageGenerateResponse(
        prisma as unknown as IncidentTriageRepo,
        { organizationId: orgId, incidentId, engineInputs: agg.inputs },
      );
      return r.body.ok ? { ok: true } : { ok: false, reason: r.body.error };
    },
    async runRemediation(orgId, incidentId) {
      const agg = await aggregateRemediationInputs(
        prisma as unknown as RemediationAggregateRepo,
        { organizationId: orgId, incidentId },
      );
      if (!agg.ok) return { ok: false, reason: agg.error };
      const r = await buildRemediationGenerateResponse(
        prisma as unknown as RemediationRepo,
        { organizationId: orgId, incidentId, triageId: agg.triageId, engineInputs: agg.inputs },
      );
      return r.body.ok ? { ok: true } : { ok: false, reason: r.body.error };
    },
    async runPolicyProposal(orgId) {
      const inputs = await aggregatePolicyProposalInputs(
        prisma as unknown as PolicyAggregatorRepo,
        orgId,
      );
      const r = await buildProposalGenerateResponse(
        prisma as unknown as PolicyResponderRepo,
        { organizationId: orgId, engineInputs: inputs },
      );
      return r.body.ok ? { ok: true } : { ok: false, reason: r.body.error };
    },
    // Phase 526 — Proactive suggestion runner. Loads memory + summary
    // timeline for the org, asks Claude (or falls back) for next-
    // action suggestions, supersedes any prior pending set.
    async runProactiveSuggestion(orgId) {
      const memoryResp = await buildAgiMemoryListResponse(
        prisma as unknown as EnrichmentRepo,
        { organizationId: orgId, take: 100 },
      );
      const timelineResp = await buildMemorySummaryTimelineResponse(
        prisma as unknown as MemorySummaryRepo,
        { organizationId: orgId, take: 20 },
      );
      const entries: SuggestionContextEntry[] = memoryResp.body.ok
        ? memoryResp.body.data.entries.map((e, i) => ({
            citationId: `e${i + 1}`,
            targetKind: e.targetKind,
            targetId: e.targetId,
            rowTargetKind: e.targetKind,
            rowTargetId: e.targetId,
            narrative: e.narrative,
            outcome: e.outcome,
            modelHint: e.modelHint,
            generatedAtIso: e.generatedAtIso,
          }))
        : [];
      const summaries: SuggestionContextSummary[] = timelineResp.body.ok
        ? timelineResp.body.data.entries.map((s, i) => ({
            citationId: `s${i + 1}`,
            targetKind: s.targetKind,
            narrative: s.narrative,
            generatedAtIso: s.generatedAtIso,
          }))
        : [];
      const r = await buildSuggestionGenerateResponse(
        prisma as unknown as ProactiveSuggestionRepo,
        {
          organizationId: orgId,
          entries,
          summaries,
          fetcher: makeLiveRationaleFetcher(),
        },
      );
      return r.body.ok ? { ok: true } : { ok: false, reason: r.body.error };
    },
  };

  const report = await runAutonomousTick(
    prisma as unknown as AutonomousTickRepo,
    runners,
  );

  // Persist the tick report for the dashboard's Autonomy page. Errors
  // are swallowed — observability storage must never break the tick.
  if (report.ok) {
    try {
      await prisma.autonomousTickLog.create({
        data: {
          organizationId: "",
          totalRuns: report.totalRuns,
          okRuns: report.okRuns,
          errorRuns: report.errorRuns,
          skippedRuns: report.skippedRuns,
          reportJson: report as unknown as object,
        },
      });
      for (const org of report.perOrg) {
        const orgOk = org.advisorRuns.filter((r) => r.outcome === "ok").length
          + org.triageRuns.filter((r) => r.outcome === "ok").length
          + org.remediationRuns.filter((r) => r.outcome === "ok").length
          + (org.policyProposalRun?.outcome === "ok" ? 1 : 0)
          + (org.proactiveSuggestionRun?.outcome === "ok" ? 1 : 0);
        const orgErr = org.advisorRuns.filter((r) => r.outcome === "error").length
          + org.triageRuns.filter((r) => r.outcome === "error").length
          + org.remediationRuns.filter((r) => r.outcome === "error").length
          + (org.policyProposalRun?.outcome === "error" ? 1 : 0)
          + (org.proactiveSuggestionRun?.outcome === "error" ? 1 : 0);
        const orgSkip = org.advisorRuns.filter((r) => r.outcome === "skipped").length
          + org.triageRuns.filter((r) => r.outcome === "skipped").length
          + org.remediationRuns.filter((r) => r.outcome === "skipped").length
          + (org.policyProposalRun?.outcome === "skipped" ? 1 : 0)
          + (org.proactiveSuggestionRun?.outcome === "skipped" ? 1 : 0);
        const orgTotal = orgOk + orgErr + orgSkip;
        await prisma.autonomousTickLog.create({
          data: {
            organizationId: org.organizationId,
            totalRuns: orgTotal,
            okRuns: orgOk,
            errorRuns: orgErr,
            skippedRuns: orgSkip,
            reportJson: org as unknown as object,
          },
        });
      }
    } catch {
      // Swallow — never block tick on persistence.
    }
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}
