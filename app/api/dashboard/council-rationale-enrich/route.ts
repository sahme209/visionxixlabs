/**
 * POST /api/dashboard/council-rationale-enrich — Phase 518.
 * Body: { decisionId }
 *
 * Generates an AI rationale enrichment for an existing council
 * decision. Loads the council row, reconstitutes the engine's
 * CouncilDecision + AdvisorInputs shapes from the persisted snapshot,
 * calls the live AI fetcher, persists the resulting enrichment row.
 *
 * Best-effort: when the AI provider isn't configured, a deterministic
 * fallback narrative is persisted with outcome="fallback_rules" so the
 * dashboard always has something to render.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import type { AdvisorCouncilRepo, CouncilRow } from "@/lib/releaseops/advisorCouncilResponder";
import type { CouncilDecision, CouncilVote } from "@/lib/releaseops/advisorCouncilEngine";
import type { AdvisorInputs } from "@/lib/releaseops/releaseAdvisorEngine";
import {
  buildEnrichmentGenerateResponse,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import { makeLiveRationaleFetcher } from "@/lib/releaseops/aiRationaleFetcher";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { decisionId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }
  const decisionId = typeof body.decisionId === "string" ? body.decisionId : null;
  if (!decisionId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { decisionId }." },
      { status: 400 },
    );
  }

  const repo = prisma as unknown as AdvisorCouncilRepo;
  const row = await repo.advisorCouncilDecision.findUnique({ where: { id: decisionId } });
  if (!row || row.organizationId !== ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "decision_not_found" }, { status: 404 });
  }

  const decision = rebuildDecisionFromRow(row);
  const inputs = rebuildInputsFromRow(row);

  const r = await buildEnrichmentGenerateResponse(
    prisma as unknown as EnrichmentRepo,
    {
      organizationId: ctx.organizationId,
      decisionId,
      decision,
      inputs,
      fetcher: makeLiveRationaleFetcher(),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "advisor_council.rationale_enriched",
      subjectKind: "council_decision",
      subjectId: decisionId,
      summary: `Rationale enrichment ${r.body.data.enrichment.outcome} · model ${r.body.data.enrichment.modelHint ?? "n/a"}`,
      actorUserId: ctx.userId ?? null,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}

/* ──────────────────────────────────────────────────────────────────
   Row → engine shapes.
   ────────────────────────────────────────────────────────────── */

function rebuildDecisionFromRow(row: CouncilRow): CouncilDecision {
  const votes = Array.isArray(row.votesJson) ? row.votesJson as CouncilVote[] : [];
  return {
    engineVersion: row.engineVersion,
    generatedAtIso: row.generatedAt.toISOString(),
    consensusKind: row.consensusKind as CouncilDecision["consensusKind"],
    agreementScore: row.agreementScore,
    title: row.title,
    rationale: row.rationale,
    votes,
    voterCount: row.voterCount,
  };
}

function rebuildInputsFromRow(row: CouncilRow): AdvisorInputs {
  const j = (row.inputsJson ?? {}) as Partial<AdvisorInputs> & { now?: string };
  const now = typeof j.now === "string" ? new Date(j.now) : row.generatedAt;
  return {
    release: j.release ?? { id: row.releaseId, status: "unknown", releaseTag: null, commitSha: null, plannedWindowStart: null, plannedWindowEnd: null },
    readiness: j.readiness ?? null,
    policyViolations: j.policyViolations ?? { blocking: 0, warning: 0, advisory: 0 },
    pendingManualFixes: j.pendingManualFixes ?? { total: 0, inProd: 0 },
    recentIncidents: j.recentIncidents ?? { open: 0, openCritical: 0, mitigated: 0 },
    branchProtection: j.branchProtection ?? { snapshotsTotal: 0, weakOrNone: 0, forcePushAllowedOnMain: false },
    previousReleaseStatus: j.previousReleaseStatus ?? null,
    hasEvidencePack: j.hasEvidencePack ?? false,
    isInPlannedFreeze: j.isInPlannedFreeze ?? false,
    now,
  };
}
