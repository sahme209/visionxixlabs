import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/prismaClient";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { MAX_VARIABLE_SETS, setScopeKey, validateSetDefinition } from "@/lib/releaseops/variableSets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });

const writeSchema = z.object({ slug: z.string().max(48), name: z.string().max(120), selector: z.string().max(200), description: z.string().max(500).nullable().optional(), expectedVersion: z.number().int().positive().optional() }).strict();
const deleteSchema = z.object({ slug: z.string().max(48), expectedVersion: z.number().int().positive() }).strict();

async function adminBody(request: NextRequest) {
  if (!isSameOriginRequest(request)) return { ok: false, error: fail("cross_origin_refused", 403) } as const;
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return { ok: false, error: fail("workspace_membership_required", 403) } as const;
  if (!isAdminOrOwner({ email: c.email, roles: c.roles })) return { ok: false, error: fail("workspace_admin_required", 403) } as const;
  const text = await request.text();
  if (text.length > 8 * 1024) return { ok: false, error: fail("payload_too_large", 413) } as const;
  let body: unknown; try { body = JSON.parse(text); } catch { return { ok: false, error: fail("invalid_payload", 400) } as const; }
  return { ok: true, ctx: { organizationId: String(c.organizationId), userId: String(c.userId) }, body } as const;
}

async function audit(ctx: { organizationId: string; userId: string }, kind: string, slug: string, detail: Record<string, unknown> = {}) {
  try {
    await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: `variable_set:${slug}`, correlationId: randomUUID() as CorrelationId, detail: { kind, slug, ...detail } });
  } catch { /* best-effort */ }
}

/** POST: create a variable set, or update its name/selector when expectedVersion still matches. Admins only. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await adminBody(request); if (!gate.ok) return gate.error;
  const parsed = writeSchema.safeParse(gate.body);
  if (!parsed.success) return fail("invalid_payload", 400);
  const { slug, selector, description = null, expectedVersion } = parsed.data;
  const name = parsed.data.name.trim();
  const issues = validateSetDefinition({ slug, name, selector });
  if (issues.length) return fail("variable_set_invalid", 422, { issues });
  const normalizedSelector = selector.trim().toLowerCase().split(/\s+/).join(" ");
  const { ctx } = gate;
  try {
    if (expectedVersion === undefined) {
      if ((await prisma.variableSet.count({ where: { organizationId: ctx.organizationId } })) >= MAX_VARIABLE_SETS) return fail("variable_set_limit_reached", 409);
      try {
        const row = await prisma.variableSet.create({ data: { organizationId: ctx.organizationId, slug, name, selector: normalizedSelector, description, updatedByUserId: ctx.userId }, select: { slug: true, version: true } });
        await audit(ctx, "variable_set.create", slug, { selector: normalizedSelector });
        return NextResponse.json({ ok: true, data: row }, { status: 201, headers: noStore });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return fail("variable_set_exists", 409);
        throw err;
      }
    }
    const r = await prisma.variableSet.updateMany({ where: { organizationId: ctx.organizationId, slug, version: expectedVersion }, data: { name, selector: normalizedSelector, description, updatedByUserId: ctx.userId, version: { increment: 1 } } });
    if (r.count !== 1) return fail("variable_set_changed", 409, { detail: "Someone changed or removed this set after you loaded it. Reload and try again." });
    await audit(ctx, "variable_set.update", slug, { selector: normalizedSelector });
    return NextResponse.json({ ok: true, data: { slug, version: expectedVersion + 1 } }, { headers: noStore });
  } catch {
    return fail("variable_sets_unavailable", 503);
  }
}

/** DELETE: remove a set and its variables together, only if the set is unchanged since it was read. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const gate = await adminBody(request); if (!gate.ok) return gate.error;
  const parsed = deleteSchema.safeParse(gate.body);
  if (!parsed.success) return fail("invalid_payload", 400);
  const { slug, expectedVersion } = parsed.data;
  const { ctx } = gate;
  try {
    const removed = await prisma.$transaction(async (tx) => {
      const r = await tx.variableSet.deleteMany({ where: { organizationId: ctx.organizationId, slug, version: expectedVersion } });
      if (r.count !== 1) return null;
      const v = await tx.configVariable.deleteMany({ where: { organizationId: ctx.organizationId, scopeKey: setScopeKey(slug) } });
      return v.count;
    });
    if (removed === null) return fail("variable_set_changed", 409, { detail: "This set changed or was already removed. Reload to see its current state." });
    await audit(ctx, "variable_set.delete", slug, { variablesRemoved: removed });
    return NextResponse.json({ ok: true, data: { variablesRemoved: removed } }, { headers: noStore });
  } catch {
    return fail("variable_sets_unavailable", 503);
  }
}
