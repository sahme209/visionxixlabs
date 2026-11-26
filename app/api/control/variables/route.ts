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
  MAX_VARIABLES_PER_WORKSPACE, resolvedDigest, scopeKeyFor, validateVariable,
} from "@/lib/releaseops/scopedVariables";
import { gapsFromResolved, MAX_VARIABLE_SETS, resolveWithSets, setScopeKey } from "@/lib/releaseops/variableSets";

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
    const [environments, variables, sets] = await Promise.all([
      prisma.environment.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, tier: true, tags: true } }),
      prisma.configVariable.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ key: "asc" }], take: MAX_VARIABLES_PER_WORKSPACE, select: { key: true, value: true, scopeKey: true, description: true, version: true, updatedAt: true } }),
      prisma.variableSet.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ slug: "asc" }], take: MAX_VARIABLE_SETS, select: { slug: true, name: true, selector: true, description: true, version: true } }),
    ]);
    // Latest recorded deployment fingerprint per environment; optional evidence, so a read failure only hides it.
    const deployed = await prisma.deploymentExecution.findMany({ where: { organizationId: ctx.organizationId, configDigest: { not: null } }, orderBy: { createdAt: "desc" }, take: 200, select: { environmentId: true, configDigest: true, createdAt: true } }).catch(() => null);
    const lastDeployed = new Map<string, { digest: string; at: string }>();
    for (const d of deployed ?? []) if (d.configDigest && !lastDeployed.has(d.environmentId)) lastDeployed.set(d.environmentId, { digest: d.configDigest, at: d.createdAt.toISOString() });
    const resolved = environments.map((e) => {
      const { resolved: r, conflicts, appliedSets } = resolveWithSets(variables, { id: e.id, tags: e.tags ?? [] }, sets); const digest = resolvedDigest(r); const last = lastDeployed.get(e.id) ?? null;
      return { environmentId: e.id, variables: r, digest, appliedSets, conflicts, lastDeployment: deployed === null ? "unavailable" as const : last ? { digest: last.digest, at: last.at, changedSince: last.digest !== digest } : null };
    });
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, environments, variables, sets, resolved, gaps: gapsFromResolved(resolved) } }, { headers: noStore });
  } catch {
    return fail("variables_unavailable", 503);
  }
}

const writeSchema = z.object({
  key: z.string().max(64),
  value: z.string().max(5000),
  environmentId: z.string().max(64).nullable(),
  /** Write into a variable set instead of the workspace or an environment. */
  setSlug: z.string().max(48).optional(),
  description: z.string().max(600).nullable().optional(),
  /** Absent: create. Present: update only if the stored version still matches. */
  expectedVersion: z.number().int().positive().optional(),
}).strict();
const deleteSchema = z.object({ key: z.string().max(64), environmentId: z.string().max(64).nullable(), setSlug: z.string().max(48).optional(), expectedVersion: z.number().int().positive() }).strict();

async function scopeFor(organizationId: string, environmentId: string | null, setSlug: string | undefined): Promise<{ ok: true; scopeKey: string } | { ok: false; error: NextResponse }> {
  if (setSlug !== undefined) {
    if (environmentId) return { ok: false, error: fail("invalid_payload", 400) };
    const set = await prisma.variableSet.findFirst({ where: { organizationId, slug: setSlug }, select: { slug: true } });
    return set ? { ok: true, scopeKey: setScopeKey(set.slug) } : { ok: false, error: fail("variable_set_not_found", 404) };
  }
  return { ok: true, scopeKey: scopeKeyFor(environmentId) };
}

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
  const { key, value, environmentId, setSlug, description = null, expectedVersion } = parsed.data;
  const { ctx } = gate;
  try {
    const scope = await scopeFor(ctx.organizationId, environmentId, setSlug);
    if (!scope.ok) return scope.error;
    const { scopeKey } = scope;
    const issues = validateVariable({ key, value, scopeKey, description });
    if (issues.length) return fail("variable_invalid", 422, { issues });
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
  const { key, environmentId, setSlug, expectedVersion } = parsed.data;
  try {
    const scope = await scopeFor(gate.ctx.organizationId, environmentId, setSlug);
    if (!scope.ok) return scope.error;
    const { scopeKey } = scope;
    const result = await prisma.configVariable.deleteMany({ where: { organizationId: gate.ctx.organizationId, scopeKey, key, version: expectedVersion } });
    if (result.count !== 1) return fail("variable_changed", 409, { detail: "This variable changed or was already removed. Reload to see its current value." });
    await audit(gate.ctx, "variable.delete", key, scopeKey);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return fail("variables_unavailable", 503);
  }
}
