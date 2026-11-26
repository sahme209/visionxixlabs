import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";
import { MAX_ENVIRONMENTS_IN_FILE, environmentsDigest, exportEnvironmentsDocument, parseEnvironmentsDocument, planEnvironments, type StoredEnvironmentRow } from "@/lib/releaseops/environmentsAsCode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });
const select = { id: true, slug: true, name: true, tier: true, displayOrder: true, tags: true, changeWindowRuleJson: true, updatedAt: true } as const;
const readRows = (organizationId: string) => prisma.environment.findMany({ where: { organizationId }, orderBy: { slug: "asc" }, take: MAX_ENVIRONMENTS_IN_FILE + 1, select }) as unknown as Promise<StoredEnvironmentRow[]>;

/** GET: download the workspace's environments as a file for Git. Members can read. */
export async function GET(): Promise<NextResponse> {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.roles.length) return fail("workspace_membership_required", 403);
  try {
    const rows = await readRows(String(c.organizationId));
    if (rows.length > MAX_ENVIRONMENTS_IN_FILE) return fail("too_many_environments", 409);
    return new NextResponse(exportEnvironmentsDocument(rows), { headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="v19-environments.json"' } });
  } catch {
    return fail("environments_unavailable", 503);
  }
}

/**
 * POST { text } previews an environments file against stored environments (plan plus a digest of what
 * was read). POST { text, apply: true, expectedDigest } applies that plan only if nothing changed since
 * the preview. It creates and updates environments; it never deletes one or changes an existing tier.
 * Owners and admins only, and refused while Governance enrollment holds configuration changes.
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
  if (!body || typeof body.text !== "string") return fail("invalid_payload", 400);
  const parsed = parseEnvironmentsDocument(body.text);
  if (!parsed.ok) return fail("environments_file_invalid", 422, { issues: parsed.errors });
  const organizationId = String(c.organizationId), userId = String(c.userId);
  try {
    const rows = await readRows(organizationId);
    if (rows.length > MAX_ENVIRONMENTS_IN_FILE) return fail("too_many_environments", 409);
    const digest = environmentsDigest(rows);
    const plan = planEnvironments(rows, parsed.document);
    if (body.apply !== true) return NextResponse.json({ ok: true, data: { plan, digest } }, { headers: noStore });
    if (body.expectedDigest !== digest) return fail("environments_changed", 409, { detail: "Environments changed since you previewed this file. Preview it again." });
    if (plan.refused.length) return fail("environments_file_refused", 422, { issues: plan.refused });
    if (!plan.ops.length) return fail("environments_unchanged", 409);
    if (rows.length + plan.ops.filter((o) => o.op === "create").length > MAX_ENVIRONMENTS_IN_FILE) return fail("environment_limit_reached", 409);
    if (!await workspaceUnenrolled(organizationId)) return fail("governance_configuration_mutation_unavailable", 409);
    try {
      await prisma.$transaction(async (tx) => {
        for (const op of plan.ops) {
          const e = op.environment;
          const rule = e.changeWindow === null ? Prisma.DbNull : (e.changeWindow as unknown as Prisma.InputJsonValue);
          if (op.op === "create") {
            await tx.environment.create({ data: { organizationId, slug: e.slug, name: e.name, tier: e.tier as never, displayOrder: e.displayOrder, tags: e.tags, changeWindowRuleJson: rule } });
          } else {
            const r = await tx.environment.updateMany({ where: { id: op.id, organizationId, updatedAt: new Date(op.expectedUpdatedAt) }, data: { name: e.name, displayOrder: e.displayOrder, tags: e.tags, changeWindowRuleJson: rule } });
            if (r.count !== 1) throw new Error("environments_changed");
          }
        }
      });
    } catch (err) {
      if ((err as Error).message === "environments_changed" || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) return fail("environments_changed", 409, { detail: "Environments changed while applying. Nothing was changed; preview the file again." });
      throw err;
    }
    try {
      await auditRecord({ organizationId: organizationId as OrganizationId, actorUserId: userId as UserId, action: "governance.update", outcome: "success", entityRef: "environments:file", correlationId: randomUUID() as CorrelationId, detail: { applied: plan.ops.map((o) => `${o.op}:${o.environment.slug}${o.op === "update" ? `(${o.fields.join(",")})` : ""}`), loosening: plan.loosening } });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, data: { applied: plan.ops.length } }, { headers: noStore });
  } catch {
    return fail("environments_unavailable", 503);
  }
}
