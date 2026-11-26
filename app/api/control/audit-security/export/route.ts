import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { AUDIT_EXPORT_DAYS, AUDIT_EXPORT_MAX_ROWS, serializeAuditExport, type AuditExportFormat } from "@/lib/audit/auditExport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });

/**
 * GET /api/control/audit-security/export?days=30&format=csv|ndjson
 * Owners and admins download this workspace's audit records for the last 1, 7, 30 or 90 days, newest
 * first, up to 10,000 rows (the X-V19-Truncated header says when more exist). The export is itself audited.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return fail("workspace_membership_required", 403);
  if (!isAdminOrOwner({ email: c.email, roles: c.roles })) return fail("workspace_admin_required", 403);
  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const format = (request.nextUrl.searchParams.get("format") ?? "csv") as AuditExportFormat;
  if (!(AUDIT_EXPORT_DAYS as readonly number[]).includes(days) || (format !== "csv" && format !== "ndjson")) return fail("invalid_query", 400);
  const organizationId = String(c.organizationId);
  try {
    const rows = await prisma.secureAuditRecord.findMany({
      where: { organizationId, occurredAt: { gte: new Date(Date.now() - days * 86_400_000) } },
      orderBy: { occurredAt: "desc" },
      take: AUDIT_EXPORT_MAX_ROWS + 1,
      select: { id: true, occurredAt: true, action: true, outcome: true, actorKind: true, actorUserId: true, entityRef: true, correlationId: true, source: true, errorCode: true },
    });
    const truncated = rows.length > AUDIT_EXPORT_MAX_ROWS;
    const body = serializeAuditExport(rows.slice(0, AUDIT_EXPORT_MAX_ROWS) as never, format);
    try { await auditRecord({ organizationId: organizationId as OrganizationId, actorUserId: String(c.userId) as UserId, action: "governance.update", outcome: "success", entityRef: "audit_export", correlationId: randomUUID() as CorrelationId, detail: { kind: "audit.export", days, format, rows: Math.min(rows.length, AUDIT_EXPORT_MAX_ROWS), truncated } }); } catch { /* best-effort */ }
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, { headers: { ...noStore, "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8", "Content-Disposition": `attachment; filename="v19-audit-${days}d-${stamp}.${format === "csv" ? "csv" : "ndjson"}"`, "X-V19-Truncated": truncated ? "true" : "false" } });
  } catch {
    return fail("audit_export_unavailable", 503);
  }
}
