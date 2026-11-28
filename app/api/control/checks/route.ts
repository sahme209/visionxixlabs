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
import { CHECK_STAGES, MAX_CHECKS_PER_WORKSPACE, stageCoverage, validateCheck, type StoredCheck } from "@/lib/releaseops/deploymentChecks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });

async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }) };
}
const select = { key: true, name: true, kind: true, stage: true, mode: true, spec: true, enabled: true, version: true, updatedAt: true } as const;

/** GET: the workspace's checks and per-stage coverage. Members can read. */
export async function GET(): Promise<NextResponse> {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const rows = await prisma.deploymentCheck.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ key: "asc" }], take: MAX_CHECKS_PER_WORKSPACE, select });
    const order = (stage: string) => { const i = (CHECK_STAGES as readonly string[]).indexOf(stage); return i < 0 ? CHECK_STAGES.length : i; };
    const checks = [...rows].sort((a, b) => order(a.stage) - order(b.stage));
    // Latest reported result per check; optional evidence, so a read failure only hides it.
    const results = await (async () => prisma.deploymentCheckResult.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { reportedAt: "desc" }, take: 500, select: { checkKey: true, checkVersion: true, status: true, runUrl: true, reportedAt: true, releaseRef: true, monthlyCostCents: true, statusReason: true } }))().catch(() => null);
    const latest: Record<string, { status: string; checkVersion: number; runUrl: string | null; reportedAt: string; monthlyCostCents?: number; previousMonthlyCostCents?: number; statusReason?: string }> = {};
    for (const r of results ?? []) {
      const seen = latest[r.checkKey];
      if (!seen) {
        latest[r.checkKey] = { status: r.status, checkVersion: r.checkVersion, runUrl: r.runUrl, reportedAt: r.reportedAt.toISOString(), ...(r.monthlyCostCents !== null && r.monthlyCostCents !== undefined ? { monthlyCostCents: r.monthlyCostCents } : {}), ...(r.statusReason ? { statusReason: r.statusReason } : {}) };
        continue;
      }
      // Cost estimates: the previous estimate for a different commit, so the board can show the change.
      const first = (results ?? []).find((x) => x.checkKey === r.checkKey)!;
      if (seen.monthlyCostCents !== undefined && seen.previousMonthlyCostCents === undefined && r.monthlyCostCents !== null && r.monthlyCostCents !== undefined && r.releaseRef !== first.releaseRef) seen.previousMonthlyCostCents = r.monthlyCostCents;
    }
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, checks, coverage: stageCoverage(checks as unknown as StoredCheck[]), latestResults: results === null ? null : latest } }, { headers: noStore });
  } catch {
    return fail("checks_unavailable", 503);
  }
}

async function adminBody(request: NextRequest) {
  if (!isSameOriginRequest(request)) return { ok: false as const, error: fail("cross_origin_refused", 403) };
  const ctx = await member();
  if (!ctx) return { ok: false as const, error: fail("workspace_membership_required", 403) };
  if (!ctx.isAdmin) return { ok: false as const, error: fail("workspace_admin_required", 403) };
  const text = await request.text();
  if (text.length > 32 * 1024) return { ok: false as const, error: fail("payload_too_large", 413) };
  try { return { ok: true as const, ctx, body: JSON.parse(text) as unknown }; } catch { return { ok: false as const, error: fail("invalid_payload", 400) }; }
}

async function audit(ctx: { organizationId: string; userId: string }, kind: string, key: string, version: number) {
  try {
    await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: `deployment_check:${key}`, correlationId: randomUUID() as CorrelationId, detail: { kind, key, version } });
  } catch { /* best-effort */ }
}

const envelope = z.object({ check: z.unknown(), enabled: z.boolean().optional(), expectedVersion: z.number().int().positive().optional() }).strict();

/** POST: create a check, or update it when expectedVersion matches the stored version. Never runs anything. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await adminBody(request); if (!gate.ok) return gate.error;
  const env = envelope.safeParse(gate.body);
  if (!env.success) return fail("invalid_payload", 400);
  const valid = validateCheck(env.data.check);
  if (!valid.ok) return fail("check_invalid", 422, { issues: valid.errors });
  const { ctx } = gate; const c = valid.check;
  const data = { name: c.name, kind: c.kind, stage: c.stage, mode: c.mode, spec: c.spec as Prisma.InputJsonValue, enabled: env.data.enabled ?? true, updatedByUserId: ctx.userId };
  try {
    if (env.data.expectedVersion === undefined) {
      if ((await prisma.deploymentCheck.count({ where: { organizationId: ctx.organizationId } })) >= MAX_CHECKS_PER_WORKSPACE) return fail("check_limit_reached", 409);
      try {
        await prisma.deploymentCheck.create({ data: { organizationId: ctx.organizationId, key: c.key, ...data } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return fail("check_exists", 409);
        throw err;
      }
      await audit(ctx, "check.create", c.key, 1);
      return NextResponse.json({ ok: true, data: { key: c.key, version: 1 } }, { status: 201, headers: noStore });
    }
    const result = await prisma.deploymentCheck.updateMany({ where: { organizationId: ctx.organizationId, key: c.key, version: env.data.expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (result.count !== 1) return fail("check_changed", 409, { detail: "Someone changed or removed this check after you loaded it. Reload and try again." });
    await audit(ctx, "check.update", c.key, env.data.expectedVersion + 1);
    return NextResponse.json({ ok: true, data: { key: c.key, version: env.data.expectedVersion + 1 } }, { headers: noStore });
  } catch {
    return fail("checks_unavailable", 503);
  }
}

/** DELETE: remove a check if it is unchanged since it was read. Past releases keep their recorded check versions. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const gate = await adminBody(request); if (!gate.ok) return gate.error;
  const parsed = z.object({ key: z.string().max(63), expectedVersion: z.number().int().positive() }).strict().safeParse(gate.body);
  if (!parsed.success) return fail("invalid_payload", 400);
  try {
    const result = await prisma.deploymentCheck.deleteMany({ where: { organizationId: gate.ctx.organizationId, key: parsed.data.key, version: parsed.data.expectedVersion } });
    if (result.count !== 1) return fail("check_changed", 409, { detail: "This check changed or was already removed. Reload to see its current state." });
    await audit(gate.ctx, "check.delete", parsed.data.key, parsed.data.expectedVersion);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return fail("checks_unavailable", 503);
  }
}
