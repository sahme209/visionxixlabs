import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/prismaClient";
import { diffPolicy, parsePolicyDocument, policyDigest } from "@/lib/releaseops/policyAsCode";
import { policyAdminContext, readPolicyRules } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

/** GET: recent policy change requests (owners and admins). */
export async function GET(): Promise<NextResponse> {
  const ctx = await policyAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "workspace_admin_required" }, { status: 403, headers: noStore });
  try {
    const requests = await prisma.policyChangeRequest.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, diffJson: true, loosens: true, status: true, proposedByUserId: true, decidedByUserId: true, decidedAt: true, createdAt: true } });
    return NextResponse.json({ ok: true, data: { viewerUserId: ctx.userId, requests } }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_requests_unavailable" }, { status: 503, headers: noStore });
  }
}

/** POST: propose a policy file as a change request. Nothing is applied until a different admin approves. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "cross_origin_refused" }, { status: 403, headers: noStore });
  const ctx = await policyAdminContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "workspace_admin_required" }, { status: 403, headers: noStore });
  const text = await request.text();
  if (text.length > 256 * 1024) return NextResponse.json({ ok: false, error: "policy_document_too_large" }, { status: 413, headers: noStore });
  const parsed = parsePolicyDocument(text);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "policy_document_invalid", issues: parsed.errors }, { status: 422, headers: noStore });
  try {
    const rules = await readPolicyRules(ctx.organizationId);
    const diff = diffPolicy(rules, parsed.document);
    if (!diff.added.length && !diff.changed.length && !diff.removed.length) return NextResponse.json({ ok: false, error: "policy_unchanged" }, { status: 409, headers: noStore });
    const row = await prisma.policyChangeRequest.create({ data: { organizationId: ctx.organizationId, documentJson: parsed.document as unknown as Prisma.InputJsonValue, baseDigest: await policyDigest(rules), diffJson: diff as unknown as Prisma.InputJsonValue, loosens: diff.loosening.length > 0, proposedByUserId: ctx.userId }, select: { id: true } });
    try { await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "policy.update", outcome: "success", entityRef: `policy_change_request:${row.id}`, correlationId: randomUUID() as CorrelationId, detail: { kind: "policy_change_requested", added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length, loosens: diff.loosening.length > 0 } }); } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, data: { id: row.id } }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_requests_unavailable" }, { status: 503, headers: noStore });
  }
}
