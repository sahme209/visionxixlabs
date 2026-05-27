/**
 * GET /api/dashboard/audit-event-list — Phase 496.
 *
 * Query params: ?kind=...&subjectKind=...&subjectId=...&limit=N
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildAuditEventListResponse,
  type AuditEventRepo,
} from "@/lib/releaseops/auditEventResponder";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(500, parseInt(limitParam, 10) || 200)) : undefined;

  const input: {
    organizationId: string;
    kind?: string;
    subjectKind?: string;
    subjectId?: string;
    limit?: number;
  } = { organizationId: ctx.organizationId };
  const kind = url.searchParams.get("kind");
  const subjectKind = url.searchParams.get("subjectKind");
  const subjectId = url.searchParams.get("subjectId");
  if (kind) input.kind = kind;
  if (subjectKind) input.subjectKind = subjectKind;
  if (subjectId) input.subjectId = subjectId;
  if (limit !== undefined) input.limit = limit;

  const r = await buildAuditEventListResponse(
    prisma as unknown as AuditEventRepo,
    input,
  );
  return NextResponse.json(r.body, { status: r.status });
}
