/**
 * PATCH /api/account/cloud-accounts/[id]
 *
 * Non-destructive pause/resume for a CloudAccount. Unlike the per-
 * provider /api/connectors/{provider}/disconnect routes (which delete
 * the connection), this just flips CloudAccount.enabled — scheduled
 * scans and dashboards can treat "disabled" as a pause rather than a
 * removal.
 *
 * Admin/owner-gated, same as /api/account/ai-policy. Verifies the
 * account belongs to the caller's organization before mutating it —
 * an admin from org A must never be able to toggle org B's account.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const account = await prisma.cloudAccount.findUnique({
    where: { id },
    select: { id: true, organizationId: true, enabled: true },
  });
  if (!account || account.organizationId !== ctx.organizationId) {
    // Same shape whether it doesn't exist or belongs to another org —
    // never reveal cross-tenant existence.
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const updated = await prisma.cloudAccount.update({
    where: { id },
    data: { enabled: body.enabled },
    select: { id: true, enabled: true },
  });

  try {
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorUserId: idFactory.user(ctx.userId),
      actorKind: "user",
      action: "cloud_account.toggle",
      outcome: "success",
      entityRef: `cloud_account:${updated.id}`,
      correlationId: idFactory.correlation(`cloud_account_toggle_${Date.now().toString(36)}`),
      source: "live",
      detail: { enabled: updated.enabled, cloudAccountId: updated.id },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, data: { id: updated.id, enabled: updated.enabled } });
}
