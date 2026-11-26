import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { MAX_CHECKS_PER_WORKSPACE } from "@/lib/releaseops/deploymentChecks";
import { checksDigest, exportChecksDocument, parseChecksDocument, planChecks, type StoredCheckRow } from "@/lib/releaseops/checksAsCode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });
const select = { key: true, name: true, kind: true, stage: true, mode: true, spec: true, enabled: true, version: true } as const;
const readRows = (organizationId: string) => prisma.deploymentCheck.findMany({ where: { organizationId }, orderBy: { key: "asc" }, take: MAX_CHECKS_PER_WORKSPACE, select }) as Promise<StoredCheckRow[]>;

/** GET: download the workspace's checks as a file for Git. Members can read. */
export async function GET(): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return fail("workspace_membership_required", 403);
  try {
    return new NextResponse(exportChecksDocument(await readRows(String(c.organizationId))), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="v19-checks.json"' } });
  } catch {
    return fail("checks_unavailable", 503);
  }
}

/**
 * POST { text, apply?: false } previews a checks file against stored checks (plan plus a digest of what
 * was read). POST { text, apply: true, expectedDigest } applies that plan only if the stored checks still
 * match the digest; checks left out of the file are disabled, never deleted. Owners and admins only.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return fail("workspace_membership_required", 403);
  if (!isAdminOrOwner({ email: c.email, roles: c.roles })) return fail("workspace_admin_required", 403);
  const raw = await request.text();
  if (raw.length > 256 * 1024) return fail("payload_too_large", 413);
  let body: { text?: unknown; apply?: unknown; expectedDigest?: unknown };
  try { body = JSON.parse(raw); } catch { return fail("invalid_payload", 400); }
  if (typeof body.text !== "string") return fail("invalid_payload", 400);
  const parsed = parseChecksDocument(body.text);
  if (!parsed.ok) return fail("checks_file_invalid", 422, { issues: parsed.errors });
  const organizationId = String(c.organizationId), userId = String(c.userId);
  try {
    const rows = await readRows(organizationId);
    const digest = checksDigest(rows);
    const plan = planChecks(rows, parsed.document);
    if (body.apply !== true) return NextResponse.json({ ok: true, data: { plan, digest } }, { headers: noStore });
    if (body.expectedDigest !== digest) return fail("checks_changed", 409, { detail: "Checks changed since you previewed this file. Preview it again." });
    if (!plan.ops.length) return fail("checks_unchanged", 409);
    const creates = plan.ops.filter((o) => o.op === "create").length;
    if (rows.length + creates > MAX_CHECKS_PER_WORKSPACE) return fail("check_limit_reached", 409);
    try {
      await prisma.$transaction(async (tx) => {
        for (const op of plan.ops) {
          if (op.op === "create") {
            const k = op.check;
            await tx.deploymentCheck.create({ data: { organizationId, key: k.key, name: k.name, kind: k.kind, stage: k.stage, mode: k.mode, spec: k.spec as Prisma.InputJsonValue, enabled: k.enabled, updatedByUserId: userId } });
          } else if (op.op === "update") {
            const k = op.check;
            const r = await tx.deploymentCheck.updateMany({ where: { organizationId, key: k.key, version: op.expectedVersion }, data: { name: k.name, kind: k.kind, stage: k.stage, mode: k.mode, spec: k.spec as Prisma.InputJsonValue, enabled: k.enabled, updatedByUserId: userId, version: { increment: 1 } } });
            if (r.count !== 1) throw new Error("checks_changed");
          } else {
            const r = await tx.deploymentCheck.updateMany({ where: { organizationId, key: op.key, version: op.expectedVersion }, data: { enabled: false, updatedByUserId: userId, version: { increment: 1 } } });
            if (r.count !== 1) throw new Error("checks_changed");
          }
        }
      });
    } catch (err) {
      if ((err as Error).message === "checks_changed" || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) return fail("checks_changed", 409, { detail: "Checks changed while applying. Nothing was changed; preview the file again." });
      throw err;
    }
    try {
      await auditRecord({ organizationId: organizationId as OrganizationId, actorUserId: userId as UserId, action: "governance.update", outcome: "success", entityRef: "deployment_checks:file", correlationId: randomUUID() as CorrelationId, detail: { applied: plan.ops.map((o) => `${o.op}:${o.op === "disable" ? o.key : o.check.key}`), loosening: plan.loosening } });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, data: { applied: plan.ops.length } }, { headers: noStore });
  } catch {
    return fail("checks_unavailable", 503);
  }
}
