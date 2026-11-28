import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { validateCustomRole } from "@/lib/desktop/customRoleCapabilities";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const MAX_ROLES = 25;

/**
 * Workspace custom roles: built-in roles with capabilities removed. Members can see them; owners and
 * admins create, change and delete them. Deleting a role removes it from every member in the same
 * transaction, so no member is left pointing at a missing role.
 */
async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }) };
}
async function audit(ctx: { organizationId: string; userId: string }, kind: string, id: string, detail: Record<string, unknown>) {
  try { await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: `workspace_custom_role:${id}`, correlationId: randomUUID() as CorrelationId, detail: { kind, ...detail } }); } catch { /* best-effort */ }
}
const roleSelect = { id: true, name: true, description: true, removedCapabilities: true, updatedAt: true } as const;

export async function GET(): Promise<NextResponse> {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const [roles, members] = await Promise.all([
      prisma.workspaceCustomRole.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { name: "asc" }, take: MAX_ROLES, select: roleSelect }),
      prisma.orgMembership.findMany({ where: { organizationId: ctx.organizationId, acceptedAt: { not: null } }, take: 500, select: { userId: true, role: true, customRoleId: true } }),
    ]);
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, roles, members } }, { headers: noStore });
  } catch { return fail("roles_unavailable", 503); }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const v = validateCustomRole(await request.json().catch(() => null));
  if (!v.ok) return fail(v.error, 400);
  try {
    if ((await prisma.workspaceCustomRole.count({ where: { organizationId: ctx.organizationId } })) >= MAX_ROLES) return fail("role_limit_reached", 409);
    const row = await prisma.workspaceCustomRole.create({ data: { organizationId: ctx.organizationId, ...v.role, createdByUserId: ctx.userId }, select: roleSelect });
    await audit(ctx, "custom_role.create", row.id, { name: row.name, removed: row.removedCapabilities });
    return NextResponse.json({ ok: true, data: row }, { status: 201, headers: noStore });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return fail("role_name_taken", 409);
    return fail("roles_unavailable", 503);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || body.id.length > 64) return fail("invalid_payload", 400);
  const v = validateCustomRole(body);
  if (!v.ok) return fail(v.error, 400);
  try {
    const r = await prisma.workspaceCustomRole.updateMany({ where: { id: body.id, organizationId: ctx.organizationId }, data: v.role });
    if (r.count !== 1) return fail("role_not_found", 404);
    await audit(ctx, "custom_role.update", body.id, { name: v.role.name, removed: v.role.removedCapabilities });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return fail("role_name_taken", 409);
    return fail("roles_unavailable", 503);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const body = z.object({ id: z.string().min(1).max(64) }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("invalid_payload", 400);
  try {
    const removed = await prisma.$transaction(async (tx) => {
      await tx.orgMembership.updateMany({ where: { organizationId: ctx.organizationId, customRoleId: body.data.id }, data: { customRoleId: null } });
      return (await tx.workspaceCustomRole.deleteMany({ where: { id: body.data.id, organizationId: ctx.organizationId } })).count;
    });
    if (removed !== 1) return fail("role_not_found", 404);
    await audit(ctx, "custom_role.delete", body.data.id, {});
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch { return fail("roles_unavailable", 503); }
}
