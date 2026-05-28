/**
 * POST /api/dashboard/remediation-rationale-enrich — Phase 520.
 * Body: { proposalId }
 *
 * Generates an AI rationale enrichment for an existing remediation
 * proposal. Loads the proposal row + reconstitutes the RemediationProposal
 * shape + inputs snapshot, calls the live AI fetcher, persists the
 * enrichment under targetKind="remediation".
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import type {
  RemediationInputs,
  RemediationKind,
  RemediationProposal,
  RemediationSeverity,
} from "@/lib/releaseops/remediationProposalEngine";
import type { RemediationRepo, RemediationRow } from "@/lib/releaseops/remediationProposalResponder";
import {
  persistEnrichment,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import { enrichRemediationRationale } from "@/lib/releaseops/aiRemediationRationaleEngine";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { isMissingTable } from "@/lib/releaseops/releaseListResponder";

export const dynamic = "force-dynamic";

const REMEDIATION_KINDS: RemediationKind[] = [
  "rollback_release", "disable_feature_flag", "increase_replicas", "restart_service",
  "redirect_traffic", "throttle_requests", "escalate_to_vendor", "no_action_recommended",
];
const REMEDIATION_SEVERITIES: RemediationSeverity[] = ["critical", "high", "medium", "low"];

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { proposalId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }
  const proposalId = typeof body.proposalId === "string" ? body.proposalId : null;
  if (!proposalId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { proposalId }." },
      { status: 400 },
    );
  }

  const repo = prisma as unknown as RemediationRepo;
  const row = await repo.remediationProposal.findUnique({ where: { id: proposalId } });
  if (!row || row.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "proposal_not_found" }, { status: 404 });
  }

  const proposal = rebuildProposalFromRow(row);
  const inputs = rebuildInputsFromRow(row);

  const fetcher = makeLiveRationaleFetcher({ engineName: "remediation_rationale", organizationId: ctx.organizationId });
  const enrichment = await enrichRemediationRationale(proposal, inputs, fetcher);

  try {
    const stored = await persistEnrichment(
      prisma as unknown as EnrichmentRepo,
      ctx.organizationId,
      proposalId,
      enrichment,
      "remediation",
    );
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "remediation_proposal.rationale_enriched",
      subjectKind: "remediation_proposal",
      subjectId: proposalId,
      summary: `Remediation rationale ${enrichment.outcome} · model ${enrichment.modelHint ?? "n/a"}`,
      actorUserId: ctx.userId ?? null,
    });
    return NextResponse.json({
      ok: true,
      data: {
        enrichment: {
          targetKind: stored.targetKind,
          targetId: stored.targetId,
          narrative: stored.narrative,
          riskFactors: Array.isArray(stored.riskFactorsJson) ? (stored.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string") : [],
          nextActions: Array.isArray(stored.nextActionsJson) ? (stored.nextActionsJson as unknown[]).filter((x): x is string => typeof x === "string") : [],
          outcome: stored.outcome,
          errorMessage: stored.errorMessage,
          modelHint: stored.modelHint,
          engineVersion: stored.engineVersion,
          generatedAtIso: stored.generatedAt.toISOString(),
        },
      },
    }, { status: 200 });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json(
        { ok: false, error: "migration_pending", hint: "Run prisma migrate deploy for 20260528140000_add_ai_rationale_enrichment." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "persist_failed", hint: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}

/* ──────────────────────────────────────────────────────────────────
   Row → engine shapes.
   ────────────────────────────────────────────────────────────── */

function rebuildProposalFromRow(row: RemediationRow): RemediationProposal {
  const kind = (REMEDIATION_KINDS as readonly string[]).includes(row.kind) ? row.kind as RemediationKind : "no_action_recommended";
  const severity = (REMEDIATION_SEVERITIES as readonly string[]).includes(row.severity) ? row.severity as RemediationSeverity : "low";
  const prerequisites = Array.isArray(row.prerequisitesJson)
    ? (row.prerequisitesJson as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return {
    kind,
    title: row.title,
    description: row.description,
    confidence: row.confidence,
    severity,
    prerequisites,
    expectedImpact: row.expectedImpact,
    rollbackPlan: row.rollbackPlan,
    estimatedMinutes: row.estimatedMinutes,
    reversible: row.reversible,
    rationale: row.rationale,
  };
}

function rebuildInputsFromRow(row: RemediationRow): RemediationInputs {
  const j = (row.inputsJson ?? {}) as Partial<RemediationInputs> & { now?: string };
  const now = typeof j.now === "string" ? new Date(j.now) : row.generatedAt;
  return {
    triage: j.triage ?? { priority: "P3", suggestedOwnerTeam: "platform-sre", recommendedRunbook: null, autoEscalate: false },
    incident: j.incident ?? { id: row.incidentId, title: "(unknown)", summary: null, severity: "unknown", reportedAtIso: row.generatedAt.toISOString() },
    release: j.release ?? { id: "", status: "unknown", releaseTag: null, previousSuccessfulTag: null, minutesSinceDeploy: 0, isProduction: false },
    releaseFeatureFlags: j.releaseFeatureFlags ?? [],
    isCapacitySaturated: j.isCapacitySaturated ?? false,
    thirdPartyDependencyHint: j.thirdPartyDependencyHint ?? false,
    highErrorRate: j.highErrorRate ?? false,
    availableRunbookKeys: j.availableRunbookKeys ?? [],
    now,
  };
}
