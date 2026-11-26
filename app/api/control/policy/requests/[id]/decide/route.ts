import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { parsePolicyDocument, planPolicyApply, policyDigest } from "@/lib/releaseops/policyAsCode";
import { policyAdminContext } from "../../../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const ruleSelect = { key: true, label: true, severity: true, blocking: true, exceptionAllowed: true, approverRole: true, evidenceRequired: true, enabled: true, description: true } as const;

/**
 * POST { decision: "approve" | "reject" }. A different owner or admin than the proposer decides.
 * Approve applies the reviewed document in one transaction, only if the rules still match the
 * digest the request was reviewed against; otherwise the request becomes stale and nothing changes.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "cross_origin_refused" }, { status: 403, headers: noStore });
  const ctx = await policyAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "workspace_admin_required" }, { status: 403, headers: noStore });
  const { id } = await params;
  const body = z.object({ decision: z.enum(["approve", "reject"]) }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400, headers: noStore });
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`v19:policy:${ctx.organizationId}`}, 0))`;
      const req = await tx.policyChangeRequest.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { status: true, proposedByUserId: true, baseDigest: true, documentJson: true } });
      if (!req) return { status: 404, error: "request_not_found" } as const;
      if (req.status !== "pending") return { status: 409, error: "request_already_decided", current: req.status } as const;
      if (req.proposedByUserId === ctx.userId) return { status: 403, error: "independent_reviewer_required" } as const;
      const decidedAt = new Date();
      if (body.data.decision === "reject") {
        const r = await tx.policyChangeRequest.updateMany({ where: { id, organizationId: ctx.organizationId, status: "pending" }, data: { status: "rejected", decidedByUserId: ctx.userId, decidedAt } });
        return r.count === 1 ? { status: 200, result: "rejected" } as const : { status: 409, error: "request_already_decided" } as const;
      }
      const rules = await tx.policyRule.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { key: "asc" }, take: 500, select: ruleSelect });
      if (await policyDigest(rules) !== req.baseDigest) {
        await tx.policyChangeRequest.updateMany({ where: { id, organizationId: ctx.organizationId, status: "pending" }, data: { status: "stale", decidedByUserId: ctx.userId, decidedAt } });
        return { status: 409, error: "policy_changed_since_request" } as const;
      }
      const parsed = parsePolicyDocument(JSON.stringify(req.documentJson));
      if (!parsed.ok) return { status: 422, error: "stored_document_invalid" } as const;
      const claim = await tx.policyChangeRequest.updateMany({ where: { id, organizationId: ctx.organizationId, status: "pending" }, data: { status: "applied", decidedByUserId: ctx.userId, decidedAt } });
      if (claim.count !== 1) return { status: 409, error: "request_already_decided" } as const;
      for (const op of planPolicyApply(rules, parsed.document)) {
        if (op.op === "disable") await tx.policyRule.updateMany({ where: { organizationId: ctx.organizationId, key: op.key }, data: { enabled: false } });
        else {
          const { key, ...fields } = op.rule;
          await tx.policyRule.upsert({ where: { organizationId_key: { organizationId: ctx.organizationId, key } }, create: { organizationId: ctx.organizationId, key, ...fields, source: "policy_file" }, update: { ...fields, source: "policy_file" } });
        }
      }
      return { status: 200, result: "applied" } as const;
    }, { timeout: 15000, maxWait: 5000 });
    if ("error" in outcome) return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status, headers: noStore });
    try { await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: outcome.result === "applied" ? "approval.grant" : "approval.deny", outcome: "success", entityRef: `policy_change_request:${id}`, correlationId: randomUUID() as CorrelationId, detail: { kind: "policy_change_decided", result: outcome.result } }); } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, data: { result: outcome.result } }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_requests_unavailable" }, { status: 503, headers: noStore });
  }
}
