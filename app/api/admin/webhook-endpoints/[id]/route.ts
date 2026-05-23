/**
 * DELETE /api/admin/webhook-endpoints/[id] — Phase 395.
 *
 * Revokes a webhook endpoint. Atomic compare-and-swap so a double-click
 * doesn't double-record the audit. Already-revoked → 404 with a
 * specific reason.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

interface RevokeBody {
  reason?: unknown;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const { id } = await context.params;
  let body: RevokeBody = {};
  try { body = (await req.json()) as RevokeBody; } catch { /* empty */ }
  const reason = typeof body.reason === "string" && body.reason.trim().length > 0
    ? body.reason.trim()
    : "revoked_by_admin";

  const updated = await prisma.webhookEndpoint.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });

  if (updated.count === 0) {
    return NextResponse.json({ ok: false, reason: "already_revoked_or_missing" }, { status: 404 });
  }

  const row = await prisma.webhookEndpoint.findUnique({
    where: { id },
    select: { organizationId: true, name: true, url: true },
  });

  if (row) {
    try {
      await recordAudit({
        organizationId: idFactory.organization(row.organizationId),
        actorKind: "system",
        action: "workforce.webhook_endpoint_revoked",
        outcome: "success",
        entityRef: `webhook_endpoint:${id}`,
        correlationId: idFactory.correlation(`webhook_revoke_${id}`),
        source: "live",
        detail: { name: row.name, url: row.url, reason, revokedBy: session.user.email },
      });
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true });
}
