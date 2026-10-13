import { NextResponse, type NextRequest } from "next/server";

import { newAuditId } from "@/lib/audit/secureAudit";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorizedContext() {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) return null;
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) return null;
  return {
    organizationId: String(context.organizationId),
    userId: String(context.userId),
  };
}

export async function GET() {
  const context = await authorizedContext();
  if (!context) return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });

  const sessions = await prisma.desktopSessionRecord.findMany({
    where: {
      organizationId: context.organizationId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      userId: true,
      deviceLabel: true,
      platform: true,
      desktopVersion: true,
      issuedAt: true,
      expiresAt: true,
      lastSeenAt: true,
    },
  });

  return NextResponse.json({ ok: true, data: { sessions } });
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
  const context = await authorizedContext();
  if (!context) return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });

  const sessionId = request.nextUrl.searchParams.get("id")?.trim();
  if (!sessionId) return NextResponse.json({ ok: false, error: "session_id_required" }, { status: 422 });

  const now = new Date();
  const correlationId = request.headers.get("x-correlation-id")?.trim() || `desktop_revoke_${crypto.randomUUID()}`;
  const revoked = await prisma.$transaction(async (tx) => {
    const result = await tx.desktopSessionRecord.updateMany({
      where: {
        id: sessionId,
        organizationId: context.organizationId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
        revokeReason: "Revoked by a workspace administrator in Axiom Control.",
      },
    });
    if (result.count !== 1) return false;

    await tx.secureAuditRecord.create({
      data: {
        id: newAuditId(),
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorKind: "user",
        action: "desktop.revoke",
        outcome: "success",
        entityRef: `desktop_session:${sessionId}`,
        correlationId,
        source: "live",
        occurredAt: now,
        detail: { authority: "workspace_admin", reason: "manual_revocation" },
      },
    });
    return true;
  });

  if (!revoked) return NextResponse.json({ ok: false, error: "active_session_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: { revoked: sessionId } });
}
