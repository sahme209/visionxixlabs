import { NextResponse, type NextRequest } from "next/server";
import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

const ASSIGNABLE_ROLES = ["admin", "operator", "security_reviewer", "finance_viewer", "read_only"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export async function GET(request: NextRequest): Promise<Response> {
  const principal = await resolveRequestDesktopSession(request, {
    requiredScope: "release_gate:read",
    route: "GET /api/desktop/workspace-members",
    allowApiKey: false,
    requiredCapability: "workspace:read",
  });
  if (!principal) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const memberships = await prisma.orgMembership.findMany({
    where: { organizationId: principal.organizationId, acceptedAt: { not: null } },
    select: { userId: true, role: true, acceptedAt: true, updatedAt: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((membership) => membership.userId) } },
    select: { id: true, email: true, name: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  return NextResponse.json({
    ok: true,
    data: {
      currentUserId: principal.userId,
      currentRole: principal.role,
      capabilities: principal.capabilities,
      members: memberships.map((membership) => ({
        userId: membership.userId,
        role: membership.role,
        email: userById.get(membership.userId)?.email ?? "Unknown member",
        displayName: userById.get(membership.userId)?.name ?? undefined,
        acceptedAt: membership.acceptedAt?.toISOString() ?? null,
        updatedAt: membership.updatedAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const principal = await resolveRequestDesktopSession(request, {
    requiredScope: "release_gate:read",
    route: "PATCH /api/desktop/workspace-members",
    allowApiKey: false,
    requiredCapability: "members:manage",
  });
  if (!principal) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const body = await request.json().catch(() => null) as { userId?: unknown; role?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const role = typeof body?.role === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(body.role)
    ? body.role as AssignableRole
    : null;
  if (!userId || !role) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  if (userId === principal.userId) {
    return NextResponse.json({ ok: false, error: "cannot_change_own_role" }, { status: 409 });
  }

  const existing = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: principal.organizationId } },
    select: { role: true, acceptedAt: true },
  });
  if (!existing?.acceptedAt) return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
  if (existing.role === "owner") {
    return NextResponse.json({ ok: false, error: "owner_role_is_protected" }, { status: 409 });
  }

  const updated = await prisma.orgMembership.update({
    where: { userId_organizationId: { userId, organizationId: principal.organizationId } },
    data: { role: role as OrgRole },
    select: { userId: true, role: true, updatedAt: true },
  });
  try {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, {
      organizationId: principal.organizationId,
      kind: "workspace.member_role_changed",
      subjectKind: "workspace_member",
      subjectId: userId,
      summary: `Changed workspace role from ${existing.role} to ${updated.role}`,
      actorUserId: principal.userId,
    });
  } catch { /* role enforcement is authoritative even if audit telemetry is unavailable */ }

  return NextResponse.json({
    ok: true,
    data: { userId: updated.userId, role: updated.role, updatedAt: updated.updatedAt.toISOString() },
  });
}
