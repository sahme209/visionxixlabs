/**
 * POST /api/dashboard/remediation-generate — Phase 512.
 * Body: { incidentId }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildRemediationGenerateResponse,
  type RemediationRepo,
} from "@/lib/releaseops/remediationProposalResponder";
import {
  aggregateRemediationInputs,
  type RemediationAggregateRepo,
} from "@/lib/releaseops/remediationProposalAggregator";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { enrichRemediationRationale } from "@/lib/releaseops/aiRemediationRationaleEngine";
import {
  persistEnrichment,
  type EnrichmentRepo,
} from "@/lib/releaseops/aiRationaleEnricherResponder";
import type {
  RemediationKind,
  RemediationProposal,
  RemediationSeverity,
} from "@/lib/releaseops/remediationProposalEngine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  let body: { incidentId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const incidentId = typeof body.incidentId === "string" ? body.incidentId : null;
  if (!incidentId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { incidentId }." },
      { status: 400 },
    );
  }

  const aggregated = await aggregateRemediationInputs(
    prisma as unknown as RemediationAggregateRepo,
    { organizationId: ctx.organizationId, incidentId },
  );
  if (!aggregated.ok) {
    const status =
      aggregated.error === "incident_not_found" ? 404 :
      aggregated.error === "release_not_found" ? 404 :
      aggregated.error === "triage_not_found" ? 409 :
      403;
    return NextResponse.json({ ok: false, error: aggregated.error, hint: aggregated.hint }, { status });
  }

  const r = await buildRemediationGenerateResponse(
    prisma as unknown as RemediationRepo,
    {
      organizationId: ctx.organizationId,
      incidentId,
      triageId: aggregated.triageId,
      engineInputs: aggregated.inputs,
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "remediation.generate",
      subjectKind: "release",
      subjectId: incidentId,
      summary: r.body.data.primary
        ? `Remediation primary: ${r.body.data.primary.title}`
        : `Remediation: ${r.body.data.proposalCount} proposal(s) — engine recommends no action`,
      actorUserId: ctx.userId ?? null,
    });

    // Phase 520 — Auto-enrich each new proposal with the deterministic
    // fallback rationale (cheap, no AI call). Operator clicks
    // "Regenerate" in the UI for a live Claude pass.
    for (const view of r.body.data.proposals) {
      try {
        const proposalShape: RemediationProposal = {
          kind: view.kind === "unknown" ? "no_action_recommended" : (view.kind as RemediationKind),
          title: view.title,
          description: view.description,
          confidence: view.confidence,
          severity: view.severity === "unknown" ? "low" : (view.severity as RemediationSeverity),
          prerequisites: view.prerequisites,
          expectedImpact: view.expectedImpact,
          rollbackPlan: view.rollbackPlan,
          estimatedMinutes: view.estimatedMinutes,
          reversible: view.reversible,
          rationale: view.rationale,
        };
        const enrichment = await enrichRemediationRationale(proposalShape, aggregated.inputs, null);
        await persistEnrichment(
          prisma as unknown as EnrichmentRepo,
          ctx.organizationId,
          view.id,
          enrichment,
          "remediation",
        );
      } catch {
        // Never blocks the source action.
      }
    }
  }
  return NextResponse.json(r.body, { status: r.status });
}
