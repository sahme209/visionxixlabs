/**
 * POST /api/dashboard/policy-proposal-decide — Phase 507.
 * Body: { proposalId, action: "accept"|"reject"|"dismiss", note?, ruleKeyOverride? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildProposalDecisionResponse,
  type PolicyProposalRepo,
  PROPOSAL_TRANSITIONS,
  type ProposalTransition,
} from "@/lib/releaseops/policyProposalResponder";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!canDecideApprovals({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "forbidden_role" }, { status: 403 });
  }
  let body: { proposalId?: unknown; action?: unknown; note?: unknown; ruleKeyOverride?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const proposalId = typeof body.proposalId === "string" ? body.proposalId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const validAction = action && (PROPOSAL_TRANSITIONS as readonly string[]).includes(action);
  if (!proposalId || !validAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { proposalId, action: 'accept'|'reject'|'dismiss', note?, ruleKeyOverride? }." },
      { status: 400 },
    );
  }

  const r = await buildProposalDecisionResponse(
    prisma as unknown as PolicyProposalRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      proposalId,
      action: action as ProposalTransition,
      ...(typeof body.note === "string" ? { note: body.note } : {}),
      ...(typeof body.ruleKeyOverride === "string" ? { ruleKeyOverride: body.ruleKeyOverride } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `policy_proposal.${action}`,
      subjectKind: "policy",
      subjectId: r.body.data.id,
      summary: r.body.data.acceptedRuleId
        ? `Policy proposal ${r.body.data.previousDecision} → ${r.body.data.decision} · created rule ${r.body.data.acceptedRuleId}`
        : `Policy proposal ${r.body.data.previousDecision} → ${r.body.data.decision}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
