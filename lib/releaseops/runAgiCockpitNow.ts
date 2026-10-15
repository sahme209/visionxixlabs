import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAutonomousTick, type AutonomousTickRepo, type EngineRunners, type OrgTickReport } from "@/lib/releaseops/autonomousTickResponder";
import { buildAdvisorGenerateResponse, type AdvisorRepo } from "@/lib/releaseops/advisorRecommendationResponder";
import { aggregateAdvisorInputs, type AdvisorInputsRepo } from "@/lib/releaseops/advisorInputsAggregator";
import { buildTriageGenerateResponse, type IncidentTriageRepo } from "@/lib/releaseops/incidentTriageResponder";
import { aggregateIncidentTriageInputs, type IncidentTriageAggregateRepo } from "@/lib/releaseops/incidentTriageAggregator";
import { buildRemediationGenerateResponse, type RemediationRepo } from "@/lib/releaseops/remediationProposalResponder";
import { aggregateRemediationInputs, type RemediationAggregateRepo } from "@/lib/releaseops/remediationProposalAggregator";
import { buildProposalGenerateResponse, type PolicyProposalRepo as PolicyResponderRepo } from "@/lib/releaseops/policyProposalResponder";
import { aggregatePolicyProposalInputs, type PolicyProposalRepo as PolicyAggregatorRepo } from "@/lib/releaseops/policyProposalAggregator";
import { buildSuggestionGenerateResponse, type ProactiveSuggestionRepo } from "@/lib/releaseops/proactiveAgiSuggestionResponder";
import type { SuggestionContextEntry, SuggestionContextSummary } from "@/lib/releaseops/proactiveAgiSuggestionEngine";
import { buildAgiMemoryListResponse, type EnrichmentRepo } from "@/lib/releaseops/aiRationaleEnricherResponder";
import { buildMemorySummaryTimelineResponse, type MemorySummaryRepo } from "@/lib/releaseops/aiMemorySummaryResponder";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

/** Shared server-side command for browser and paired-desktop routes. */
export async function runAgiCockpitNowForOrganization(orgId: string, actorUserId: string | null) {
  const runners: EngineRunners = {
    async runAdvisor(organizationId, releaseId) {
      const agg = await aggregateAdvisorInputs(prisma as unknown as AdvisorInputsRepo, { organizationId, releaseId });
      if (!agg.ok) return { ok: false, reason: agg.error };
      const response = await buildAdvisorGenerateResponse(prisma as unknown as AdvisorRepo, { organizationId, releaseId, engineInputs: agg.inputs });
      return response.body.ok ? { ok: true } : { ok: false, reason: response.body.error };
    },
    async runTriage(organizationId, incidentId) {
      const agg = await aggregateIncidentTriageInputs(prisma as unknown as IncidentTriageAggregateRepo, { organizationId, incidentId });
      if (!agg.ok) return { ok: false, reason: agg.error };
      const response = await buildTriageGenerateResponse(prisma as unknown as IncidentTriageRepo, { organizationId, incidentId, engineInputs: agg.inputs });
      return response.body.ok ? { ok: true } : { ok: false, reason: response.body.error };
    },
    async runRemediation(organizationId, incidentId) {
      const agg = await aggregateRemediationInputs(prisma as unknown as RemediationAggregateRepo, { organizationId, incidentId });
      if (!agg.ok) return { ok: false, reason: agg.error };
      const response = await buildRemediationGenerateResponse(prisma as unknown as RemediationRepo, { organizationId, incidentId, triageId: agg.triageId, engineInputs: agg.inputs });
      return response.body.ok ? { ok: true } : { ok: false, reason: response.body.error };
    },
    async runPolicyProposal(organizationId) {
      const inputs = await aggregatePolicyProposalInputs(prisma as unknown as PolicyAggregatorRepo, organizationId);
      const response = await buildProposalGenerateResponse(prisma as unknown as PolicyResponderRepo, { organizationId, engineInputs: inputs });
      return response.body.ok ? { ok: true } : { ok: false, reason: response.body.error };
    },
    async runProactiveSuggestion(organizationId) {
      const memoryResponse = await buildAgiMemoryListResponse(prisma as unknown as EnrichmentRepo, { organizationId, take: 100 });
      const timelineResponse = await buildMemorySummaryTimelineResponse(prisma as unknown as MemorySummaryRepo, { organizationId, take: 20 });
      const entries: SuggestionContextEntry[] = memoryResponse.body.ok ? memoryResponse.body.data.entries.map((entry, index) => ({ citationId: `e${index + 1}`, targetKind: entry.targetKind, targetId: entry.targetId, rowTargetKind: entry.targetKind, rowTargetId: entry.targetId, narrative: entry.narrative, outcome: entry.outcome, modelHint: entry.modelHint, generatedAtIso: entry.generatedAtIso })) : [];
      const summaries: SuggestionContextSummary[] = timelineResponse.body.ok ? timelineResponse.body.data.entries.map((summary, index) => ({ citationId: `s${index + 1}`, targetKind: summary.targetKind, narrative: summary.narrative, generatedAtIso: summary.generatedAtIso })) : [];
      const response = await buildSuggestionGenerateResponse(prisma as unknown as ProactiveSuggestionRepo, { organizationId, entries, summaries, fetcher: makeLiveRationaleFetcher({ engineName: "proactive_suggestion", organizationId }) });
      return response.body.ok ? { ok: true } : { ok: false, reason: response.body.error };
    },
  };
  const scopedRepo: AutonomousTickRepo = { ...(prisma as unknown as AutonomousTickRepo), organization: { async findMany() { return [{ id: orgId }]; } } };
  const report = await runAutonomousTick(scopedRepo, runners, { config: { advisorMaxAgeHours: 0.0001, triageMaxAgeHours: 0.0001, remediationMaxAgeHours: 0.0001, policyProposalMaxAgeHours: 0.0001, proactiveSuggestionMaxAgeHours: 0.0001 } });
  if (!report.ok) return NextResponse.json(report, { status: 503 });
  const orgReport: OrgTickReport | undefined = report.perOrg[0];
  await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: orgId, kind: "agi_cockpit.run_now", subjectKind: "agi_cockpit", subjectId: orgId, summary: `Manual AGI tick · ${report.okRuns} ok · ${report.errorRuns} err · ${report.skippedRuns} skipped`, actorUserId });
  return NextResponse.json({ ok: true, data: { report, org: orgReport ?? null } }, { status: 200 });
}
