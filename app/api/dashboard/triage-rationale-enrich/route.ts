/**
 * POST /api/dashboard/triage-rationale-enrich — Phase 519.
 * Body: { triageId }
 *
 * Generates an AI rationale enrichment for an existing incident-triage
 * decision. Loads the triage row + reconstitutes the engine output +
 * triage inputs snapshot, calls the live AI fetcher, persists the
 * resulting enrichment row keyed by targetKind="triage".
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import type {
  IncidentTriageInputs,
  IncidentTriageOutput,
  TriagePriority,
  TriageRunbook,
} from "@/lib/releaseops/incidentTriageEngine";
import type { IncidentTriageRepo, TriageRow } from "@/lib/releaseops/incidentTriageResponder";
import {
  persistEnrichment,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import { enrichTriageRationale } from "@/lib/releaseops/aiTriageRationaleEngine";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { isMissingTable } from "@/lib/releaseops/releaseListResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { triageId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }
  const triageId = typeof body.triageId === "string" ? body.triageId : null;
  if (!triageId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { triageId }." },
      { status: 400 },
    );
  }

  const triageRepo = prisma as unknown as IncidentTriageRepo;
  const row = await triageRepo.incidentTriage.findUnique({ where: { id: triageId } });
  if (!row || row.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "triage_not_found" }, { status: 404 });
  }

  const triageOutput = rebuildTriageFromRow(row);
  const triageInputs = rebuildInputsFromRow(row);

  const fetcher = makeLiveRationaleFetcher();
  const enrichment = await enrichTriageRationale(triageOutput, triageInputs, fetcher);

  try {
    const stored = await persistEnrichment(
      prisma as unknown as EnrichmentRepo,
      ctx.organizationId,
      triageId,
      enrichment,
      "triage",
    );
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "incident_triage.rationale_enriched",
      subjectKind: "triage_decision",
      subjectId: triageId,
      summary: `Triage rationale ${enrichment.outcome} · model ${enrichment.modelHint ?? "n/a"}`,
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

const PRIORITIES: TriagePriority[] = ["P0", "P1", "P2", "P3"];
const RUNBOOKS: TriageRunbook[] = [
  "checkout_outage", "auth_outage", "data_loss", "elevated_error_rate",
  "rollback_drill", "perf_regression", "third_party_dependency_outage", "infra_capacity",
];

function rebuildTriageFromRow(row: TriageRow): IncidentTriageOutput {
  const priority = (PRIORITIES as readonly string[]).includes(row.priority) ? row.priority as TriagePriority : "P3";
  const runbook = row.recommendedRunbook && (RUNBOOKS as readonly string[]).includes(row.recommendedRunbook)
    ? row.recommendedRunbook as TriageRunbook
    : null;
  return {
    engineVersion: row.engineVersion,
    generatedAtIso: row.generatedAt.toISOString(),
    priority,
    suggestedOwnerTeam: row.suggestedOwnerTeam,
    estimatedTimeToMitigateMinutes: row.estimatedTimeToMitigateMinutes,
    recommendedRunbook: runbook,
    autoEscalate: row.autoEscalate,
    confidence: row.confidence,
    rationale: row.rationale,
    responseDeadlineIso: row.generatedAt.toISOString(),
  };
}

function rebuildInputsFromRow(row: TriageRow): IncidentTriageInputs {
  const j = (row.inputsJson ?? {}) as Partial<IncidentTriageInputs> & { now?: string };
  const now = typeof j.now === "string" ? new Date(j.now) : row.generatedAt;
  return {
    incident: j.incident ?? { id: row.incidentId, severity: "unknown", title: "(unknown)", summary: null, reportedAtIso: row.generatedAt.toISOString() },
    release: j.release ?? { id: "", status: "unknown", releaseTag: null, isProduction: false, deployedAtIso: null },
    openCriticalIncidentsOnThisRelease: j.openCriticalIncidentsOnThisRelease ?? 0,
    pendingAdvisorBlockKinds: j.pendingAdvisorBlockKinds ?? [],
    similarHistoricalIncidents: j.similarHistoricalIncidents ?? 0,
    medianHistoricalMitigationMinutes: j.medianHistoricalMitigationMinutes ?? 0,
    businessImpactHint: j.businessImpactHint ?? null,
    isInPlannedFreeze: j.isInPlannedFreeze ?? false,
    now,
  };
}
