import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { MAX_FREEZE_HOURS, activeFreezes } from "@/lib/releaseops/deploymentFreeze";
import { applyDeploymentFreeze } from "@/lib/releaseops/deploymentFreezeStore";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });

async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }) };
}

/** GET: active freezes across the workspace's environments. Members can read. */
export async function GET(): Promise<NextResponse> {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const rows = await prisma.environment.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], take: 100, select: { id: true, name: true, tier: true, changeWindowRuleJson: true } }) as unknown as Array<{ id: string; name: string; tier: string; changeWindowRuleJson: unknown }>;
    const { freezes, unreadable } = activeFreezes(rows, new Date());
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, environments: rows.map((r) => ({ id: r.id, name: r.name, tier: r.tier })), freezes, unreadable } }, { headers: noStore });
  } catch {
    return fail("freezes_unavailable", 503);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), scope: z.enum(["production", "all"]), hours: z.number().int().min(1).max(MAX_FREEZE_HOURS), reason: z.string().trim().min(3).max(200) }).strict(),
  z.object({ action: z.literal("end"), reason: z.string().trim().min(1).max(200) }).strict(),
]);

/**
 * POST { action: "start", scope, hours, reason } freezes production (tier prod) or every environment from
 * now for the given hours; POST { action: "end", reason } ends active freezes with exactly that reason.
 * Owners and admins only.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_payload", 400);
  const body = parsed.data;
  try {
    const out = await applyDeploymentFreeze(ctx.organizationId, body);
    if (!out.ok) return fail(out.error, 409, out.skipped ? { skipped: out.skipped } : {});
    try {
      await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: "deployment_freeze", correlationId: randomUUID() as CorrelationId, detail: { kind: body.action === "start" ? "deployment_freeze.start" : "deployment_freeze.end", reason: body.reason, environments: out.environments, ...(body.action === "start" ? { hours: body.hours, scope: body.scope } : {}) } });
    } catch { /* best-effort */ }
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId: ctx.organizationId, kind: body.action === "start" ? "environment.freeze" : "environment.freeze_end", subjectKind: "environment", subjectId: `freeze:${randomUUID()}`, summary: body.action === "start" ? `Froze ${out.environments.join(", ")} until ${out.endsAt}: ${body.reason}` : `Ended freeze on ${out.environments.join(", ")}: ${body.reason}`, actorUserId: ctx.userId, detailJson: { source: "cockpit", reason: body.reason, environments: out.environments, ...(body.action === "start" ? { scope: body.scope, hours: body.hours, endsAt: out.endsAt } : {}) } });
    return NextResponse.json({ ok: true, data: { environments: out.environments, skipped: out.skipped } }, { headers: noStore });
  } catch {
    return fail("freezes_unavailable", 503);
  }
}
