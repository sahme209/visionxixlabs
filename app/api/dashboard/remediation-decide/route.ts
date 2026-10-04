/**
 * POST /api/dashboard/remediation-decide — Phase 512.
 * Body: { proposalId, action: "accept"|"reject"|"implement"|"dismiss", note?, linkedManualFixId? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  buildRemediationDecisionResponse,
  type RemediationRepo,
  REMEDIATION_TRANSITIONS,
  type RemediationTransition,
} from "@/lib/releaseops/remediationProposalResponder";
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
  let body: { proposalId?: unknown; action?: unknown; note?: unknown; linkedManualFixId?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const proposalId = typeof body.proposalId === "string" ? body.proposalId : null;
  const action = typeof body.action === "string" ? body.action : null;
  const validAction = action && (REMEDIATION_TRANSITIONS as readonly string[]).includes(action);
  if (!proposalId || !validAction) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { proposalId, action: 'accept'|'reject'|'implement'|'dismiss', note?, linkedManualFixId? }." },
      { status: 400 },
    );
  }

  const r = await buildRemediationDecisionResponse(
    prisma as unknown as RemediationRepo,
    {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      proposalId,
      action: action as RemediationTransition,
      ...(typeof body.note === "string" ? { note: body.note } : {}),
      ...(typeof body.linkedManualFixId === "string" ? { linkedManualFixId: body.linkedManualFixId } : {}),
    },
  );

  if (r.body.ok) {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: ctx.organizationId,
      kind: `remediation.${action}`,
      subjectKind: "release",
      subjectId: r.body.data.id,
      summary: `Remediation ${r.body.data.previousDecision} → ${r.body.data.decision}`,
      actorUserId: ctx.userId,
    });
  }
  return NextResponse.json(r.body, { status: r.status });
}
