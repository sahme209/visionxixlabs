/**
 * POST /api/dashboard/agi-cockpit-run-now — Phase 530.
 *
 * Operator-triggered manual autonomous tick scoped to the current
 * organization. Same runners the hourly cron uses, but skip-thresholds
 * are aggressively shortened (1s) so every engine actually fires —
 * the whole point of "Run AGI now" is to get a fresh sweep.
 *
 * Returns the per-org tick report so the cockpit can render
 * "advisor: 2 ok · triage: 1 skipped · suggestion: 1 ok".
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  runAutonomousTick,
  type AutonomousTickRepo,
  type EngineRunners,
  type OrgTickReport,
} from "@/lib/releaseops/autonomousTickResponder";
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
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const orgId = ctx.organizationId;

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
          fetcher: makeLiveRationaleFetcher({ engineName: "proactive_suggestion", organizationId: orgId }),
        },
      );
      return r.body.ok ? { ok: true } : { ok: false, reason: r.body.error };
    },
  };

  // Phase 530 — Scope the tick to this org by injecting a single-org
  // organization.findMany result. Aggressive skip thresholds (0.0001h)
  // so every engine actually fires on demand.
  const scopedRepo: AutonomousTickRepo = {
    ...(prisma as unknown as AutonomousTickRepo),
    organization: {
      async findMany() { return [{ id: orgId }]; },
    },
  };

  const report = await runAutonomousTick(scopedRepo, runners, {
    config: {
      advisorMaxAgeHours: 0.0001,
      triageMaxAgeHours: 0.0001,
      remediationMaxAgeHours: 0.0001,
      policyProposalMaxAgeHours: 0.0001,
      proactiveSuggestionMaxAgeHours: 0.0001,
    },
  });

  if (report.ok) {
    const orgReport: OrgTickReport | undefined = report.perOrg[0];
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: orgId,
      kind: "agi_cockpit.run_now",
      subjectKind: "agi_cockpit",
      subjectId: orgId,
      summary: `Manual AGI tick · ${report.okRuns} ok · ${report.errorRuns} err · ${report.skippedRuns} skipped`,
      actorUserId: ctx.userId ?? null,
    });
    return NextResponse.json({
      ok: true,
      data: {
        report,
        org: orgReport ?? null,
      },
    }, { status: 200 });
  }

  return NextResponse.json(report, { status: 503 });
}
