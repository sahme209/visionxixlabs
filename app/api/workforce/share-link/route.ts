/**
 * POST /api/workforce/share-link — Phase 634.
 *
 * Mints a signed read-only URL for an AGI memory entry. Operator
 * supplies (targetKind, targetId, ttlDays). The route enforces:
 *   · Auth: requireContext()
 *   · Cross-tenant guard: the AiRationaleEnrichment row's
 *     organizationId must equal the caller's workspace
 *   · TTL bounds: 1-90 days
 *
 * Returns JSON { url, expiresAt }. The operator copies the URL and
 * shares it with whoever needs read access.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { createShareToken } from "@/lib/workforce/domains/shareLinks";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ShareRequest {
  targetKind: string;
  targetId: string;
  ttlDays?: number;
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);

  let body: ShareRequest;
  try {
    body = await req.json() as ShareRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.targetKind !== "string" || typeof body.targetId !== "string") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const ttlDays = Math.max(1, Math.min(90, Number(body.ttlDays) || 14));

  // Cross-tenant guard — the row MUST belong to the caller's workspace.
  // Without this check, an authenticated user could mint a share link
  // for any row in any tenant by guessing (kind,id).
  const row = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: org,
        targetKind: body.targetKind,
        targetId: body.targetId,
      },
    },
    select: { id: true },
  }).catch(() => null);

  if (!row) {
    return NextResponse.json({ error: "not_found_or_not_yours" }, { status: 404 });
  }

  let token: string;
  try {
    token = createShareToken(org, body.targetKind, body.targetId, ttlDays);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg === "share_link_secret_missing_or_too_short") {
      return NextResponse.json({ error: "secret_misconfigured" }, { status: 500 });
    }
    throw err;
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const url = `${baseUrl.replace(/\/$/, "")}/share/${token}`;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // Audit the mint so workspace admins can see who shared what.
  const correlationId = `share_link_${Date.now().toString(36)}` as CorrelationId;
  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "engineer.action_attempted",
    outcome: "success",
    entityRef: `share-link:${body.targetKind}:${body.targetId}`,
    correlationId,
    detail: {
      action: "share_link_minted",
      targetKind: body.targetKind,
      targetId: body.targetId,
      ttlDays,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return NextResponse.json({ url, expiresAt: expiresAt.toISOString() });
}
