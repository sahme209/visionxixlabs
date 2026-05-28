/**
 * POST /api/dashboard/policy-proposal-generate — Phase 507.
 *
 * Aggregates org-level signals and runs the autonomous policy
 * proposal engine. Persists fresh proposals, suppresses dupes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildProposalGenerateResponse,
  type PolicyProposalRepo as ResponderRepo,
} from "@/lib/releaseops/policyProposalResponder";
import {
  aggregatePolicyProposalInputs,
  type PolicyProposalRepo as AggregatorRepo,
} from "@/lib/releaseops/policyProposalAggregator";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const engineInputs = await aggregatePolicyProposalInputs(
    prisma as unknown as AggregatorRepo,
    ctx.organizationId,
  );

  const r = await buildProposalGenerateResponse(
    prisma as unknown as ResponderRepo,
    { organizationId: ctx.organizationId, engineInputs },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: "policy_proposal.generate",
      subjectKind: "policy",
      subjectId: "org",
      summary: `Policy proposals: ${r.body.data.newProposalCount} new · ${r.body.data.suppressedExisting} suppressed (existing) · ${r.body.data.suppressedPending} suppressed (pending)`,
      actorUserId: ctx.userId ?? null,
    });
  }

  return NextResponse.json(r.body, { status: r.status });
}
