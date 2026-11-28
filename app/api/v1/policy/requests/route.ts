/**
 * POST /api/v1/policy/requests  { document }
 * Proposes a policy file (Terraform, CI). It becomes a policy change request in Governance → Policy as
 * code, recorded as proposed by the person who created the API key, so that person cannot approve it:
 * a different owner or admin must. Nothing is applied here. A document identical to the current rules
 * returns { unchanged: true }; one identical to a pending request returns that request.
 * Auth: API key with policy:propose.
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/prismaClient";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { diffPolicy, isPolicyDiffEmpty, parsePolicyDocument, policyDigest } from "@/lib/releaseops/policyAsCode";
import { readAutopilot, readPolicyRules } from "@/app/api/control/policy/shared";
import { noStore, policyKey } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const key = await policyKey(req, "POST /api/v1/policy/requests");
  if (!key.ok) return key.response;
  const text = await req.text();
  if (text.length > 256 * 1024) return NextResponse.json({ ok: false, error: "policy_document_too_large" }, { status: 413, headers: noStore });
  let body: unknown; try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400, headers: noStore }); }
  const raw = body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 ? (body as { document?: unknown }).document : undefined;
  if (raw === undefined) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400, headers: noStore });
  const parsed = parsePolicyDocument(JSON.stringify(raw));
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "policy_document_invalid", issues: parsed.errors }, { status: 422, headers: noStore });
  try {
    // The key's creator is the accountable proposer; they must still be an owner or admin of this workspace.
    const keyRow = await prisma.apiKey.findFirst({ where: { id: key.apiKeyId, organizationId: key.organizationId }, select: { createdBy: true } });
    const creator = keyRow?.createdBy?.trim().toLowerCase();
    const user = creator ? await prisma.user.findFirst({ where: { email: { equals: creator, mode: "insensitive" } }, select: { id: true } }) : null;
    const membership = user ? await prisma.orgMembership.findFirst({ where: { userId: user.id, organizationId: key.organizationId, role: { in: ["owner", "admin"] } }, select: { userId: true } }) : null;
    const proposer = membership ? { id: membership.userId } : null;
    if (!proposer) return NextResponse.json({ ok: false, error: "key_owner_not_admin", detail: "The key must be created by a current owner or admin of this workspace." }, { status: 403, headers: noStore });
    const [rules, autopilot] = await Promise.all([readPolicyRules(key.organizationId), readAutopilot(key.organizationId)]);
    const diff = diffPolicy(rules, parsed.document, autopilot);
    if (isPolicyDiffEmpty(diff)) return NextResponse.json({ ok: true, unchanged: true }, { headers: noStore });
    const wanted = JSON.stringify(parsed.document);
    const pending = await prisma.policyChangeRequest.findMany({ where: { organizationId: key.organizationId, status: "pending" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, documentJson: true, loosens: true } });
    const same = pending.find((r) => JSON.stringify(r.documentJson) === wanted);
    if (same) return NextResponse.json({ ok: true, request: { id: same.id, status: "pending", loosens: same.loosens, existing: true } }, { headers: noStore });
    const row = await prisma.policyChangeRequest.create({ data: { organizationId: key.organizationId, documentJson: parsed.document as unknown as Prisma.InputJsonValue, baseDigest: await policyDigest(rules, autopilot), diffJson: diff as unknown as Prisma.InputJsonValue, loosens: diff.loosening.length > 0, proposedByUserId: proposer.id }, select: { id: true } });
    try { await auditRecord({ organizationId: key.organizationId as OrganizationId, actorUserId: proposer.id as UserId, action: "policy.update", outcome: "success", entityRef: `policy_change_request:${row.id}`, correlationId: randomUUID() as CorrelationId, detail: { kind: "policy_change_requested", via: "api_key", apiKeyId: key.apiKeyId, loosens: diff.loosening.length > 0 } }); } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, request: { id: row.id, status: "pending", loosens: diff.loosening.length > 0, existing: false } }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_requests_unavailable" }, { status: 503, headers: noStore });
  }
}
