import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import {
  MAX_VARIABLES_PER_WORKSPACE, partialKeys, resolveVariables, resolvedDigest, scopeKeyFor, validateVariable,
} from "@/lib/releaseops/scopedVariables";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });

async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }), raw: c };
}

/** GET: variables, what each environment resolves to, and keys some environments lack. */
export async function GET() {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const [environments, variables] = await Promise.all([
      prisma.environment.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, tier: true } }),
      prisma.configVariable.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ key: "asc" }], take: MAX_VARIABLES_PER_WORKSPACE, select: { key: true, value: true, scopeKey: true, description: true, version: true, updatedAt: true } }),
    ]);
    const resolved = environments.map((e) => { const r = resolveVariables(variables, e.id); return { environmentId: e.id, variables: r, digest: resolvedDigest(r) }; });
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, environments, variables, resolved, gaps: partialKeys(variables, environments.map((e) => e.id)) } }, { headers: noStore });
  } catch {
    return fail("variables_unavailable", 503);
  }
}

const writeSchema = z.object({
  key: z.string().max(64),
  value: z.string().max(5000),
  environmentId: z.string().max(64).nullable(),
  description: z.string().max(600).nullable().optional(),
  /** Absent: create. Present: update only if the stored version still matches. */
  expectedVersion: z.number().int().positive().optional(),
}).strict();
const deleteSchema = z.object({ key: z.string().max(64), environmentId: z.string().max(64).nullable(), expectedVersion: z.number().int().positive() }).strict();

async function adminWrite(request: NextRequest) {
  if (!isSameOriginRequest(request)) return { ok: false, error: fail("cross_origin_refused", 403) } as const;
  const ctx = await member();
  if (!ctx) return { ok: false, error: fail("workspace_membership_required", 403) } as const;
  if (!ctx.isAdmin) return { ok: false, error: fail("workspace_admin_required", 403) } as const;
  const text = await request.text();
  if (text.length > 16 * 1024) return { ok: false, error: fail("payload_too_large", 413) } as const;
  let body: unknown; try { body = JSON.parse(text); } catch { return { ok: false, error: fail("invalid_payload", 400) } as const; }
  return { ok: true, ctx, body } as const;
}

async function environmentBelongs(organizationId: string, environmentId: string | null) {
  if (!environmentId) return true;
  return Boolean(await prisma.environment.findFirst({ where: { id: environmentId, organizationId }, select: { id: true } }));
}

async function audit(ctx: { organizationId: string; userId: string }, kind: string, key: string, scopeKey: string, outcome: "success" | "failure" = "success") {
  try {
    await auditRecord({
      organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome,
      entityRef: `config_variable:${scopeKey}:${key}`, correlationId: randomUUID() as CorrelationId,
      detail: { kind, key, scopeKey }, // the value is configuration but is still not copied into the audit trail
    });
  } catch { /* best-effort: audit outages never block a committed change */ }
}

/** POST: create or update one variable. Never stores credential-like values. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await adminWrite(request); if (!gate.ok) return gate.error;
  const parsed = writeSchema.safeParse(gate.body);
  if (!parsed.success) return fail("invalid_payload", 400);
  const { key, value, environmentId, description = null, expectedVersion } = parsed.data;
  const scopeKey = scopeKeyFor(environmentId);
  const issues = validateVariable({ key, value, scopeKey, description });
  if (issues.length) return fail("variable_invalid", 422, { issues });
  const { ctx } = gate;
  try {
    if (!(await environmentBelongs(ctx.organizationId, environmentId))) return fail("environment_not_found", 404);
    if (expectedVersion === undefined) {
      const count = await prisma.configVariable.count({ where: { organizationId: ctx.organizationId } });
      if (count >= MAX_VARIABLES_PER_WORKSPACE) return fail("variable_limit_reached", 409);
      try {
        const row = await prisma.configVariable.create({ data: { organizationId: ctx.organizationId, scopeKey, environmentId, key, value, description, updatedByUserId: ctx.userId }, select: { key: true, scopeKey: true, version: true } });
        await audit(ctx, "variable.create", key, scopeKey);
        return NextResponse.json({ ok: true, data: row }, { status: 201, headers: noStore });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return fail("variable_exists", 409);
        throw err;
      }
    }
    const result = await prisma.configVariable.updateMany({
      where: { organizationId: ctx.organizationId, scopeKey, key, version: expectedVersion },
      data: { value, description, updatedByUserId: ctx.userId, version: { increment: 1 } },
    });
    if (result.count !== 1) return fail("variable_changed", 409, { detail: "Someone changed or removed this variable after you loaded it. Reload and try again." });
    await audit(ctx, "variable.update", key, scopeKey);
    return NextResponse.json({ ok: true, data: { key, scopeKey, version: expectedVersion + 1 } }, { headers: noStore });
  } catch {
    return fail("variables_unavailable", 503);
  }
}

/** DELETE: remove one variable if it is unchanged since it was read. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const gate = await adminWrite(request); if (!gate.ok) return gate.error;
  const parsed = deleteSchema.safeParse(gate.body);
  if (!parsed.success) return fail("invalid_payload", 400);
  const { key, environmentId, expectedVersion } = parsed.data;
  const scopeKey = scopeKeyFor(environmentId);
  try {
    const result = await prisma.configVariable.deleteMany({ where: { organizationId: gate.ctx.organizationId, scopeKey, key, version: expectedVersion } });
    if (result.count !== 1) return fail("variable_changed", 409, { detail: "This variable changed or was already removed. Reload to see its current value." });
    await audit(gate.ctx, "variable.delete", key, scopeKey);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return fail("variables_unavailable", 503);
  }
}
