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
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import { MAX_FREEZE_HOURS, activeFreezes, addFreeze, endFreezeEarly } from "@/lib/releaseops/deploymentFreeze";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });
const MAX_ENVIRONMENTS = 100;
const select = { id: true, name: true, tier: true, changeWindowRuleJson: true, updatedAt: true } as const;
type Row = { id: string; name: string; tier: string; changeWindowRuleJson: unknown; updatedAt: Date };

async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }) };
}

/** GET: active freezes across the workspace's environments. Members can read. */
export async function GET(): Promise<NextResponse> {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const rows = await prisma.environment.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], take: MAX_ENVIRONMENTS, select }) as unknown as Row[];
    const { freezes, unreadable } = activeFreezes(rows, new Date());
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, environments: rows.map((r) => ({ id: r.id, name: r.name, tier: r.tier })), freezes, unreadable } }, { headers: noStore });
  } catch {
    return fail("freezes_unavailable", 503);
  }
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), scope: z.enum(["production", "all"]), hours: z.number().int().min(1).max(MAX_FREEZE_HOURS), reason: z.string().trim().min(3).max(200) }).strict(),
  z.object({ action: z.literal("end"), reason: z.string().trim().min(1).max(200) }).strict(),
]);

/**
 * POST { action: "start", scope, hours, reason } freezes production (tier prod) or every environment from
 * now for the given hours; POST { action: "end", reason } ends active freezes with exactly that reason.
 * Owners and admins only. Each environment is written compare-and-set; all or nothing.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_payload", 400);
  const body = parsed.data;
  const now = new Date();
  try {
    if (!await workspaceUnenrolled(ctx.organizationId)) return fail("governance_configuration_mutation_unavailable", 409);
    const rows = await prisma.environment.findMany({ where: { organizationId: ctx.organizationId, ...(body.action === "start" && body.scope === "production" ? { tier: "prod" as never } : {}) }, take: MAX_ENVIRONMENTS, select }) as unknown as Row[];
    const writes: Array<{ row: Row; rule: unknown }> = []; const skipped: string[] = [];
    for (const row of rows) {
      if (body.action === "start") {
        const r = addFreeze(row.changeWindowRuleJson, { startUtc: now.toISOString(), endUtc: new Date(now.getTime() + body.hours * 3_600_000).toISOString(), reason: body.reason }, now);
        if (r.ok) writes.push({ row, rule: r.rule }); else skipped.push(`${row.name}: ${r.error === "rule_unreadable" ? "its change window cannot be read, so deployments there are already refused" : "it already has 50 active or upcoming freezes"}`);
      } else {
        const r = endFreezeEarly(row.changeWindowRuleJson, body.reason, now);
        if (r.ok && r.ended > 0) writes.push({ row, rule: r.rule });
      }
    }
    if (!writes.length) return fail(body.action === "start" ? "no_environments_to_freeze" : "no_matching_freeze", 409, { skipped });
    try {
      await prisma.$transaction(async (tx) => {
        for (const w of writes) {
          const res = await tx.environment.updateMany({ where: { id: w.row.id, organizationId: ctx.organizationId, updatedAt: w.row.updatedAt }, data: { changeWindowRuleJson: w.rule === null ? Prisma.DbNull : (w.rule as Prisma.InputJsonValue) } });
          if (res.count !== 1) throw new Error("environments_changed");
        }
      });
    } catch (err) {
      if ((err as Error).message === "environments_changed") return fail("environments_changed", 409);
      throw err;
    }
    const names = writes.map((w) => w.row.name);
    try {
      await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: "deployment_freeze", correlationId: randomUUID() as CorrelationId, detail: { kind: body.action === "start" ? "deployment_freeze.start" : "deployment_freeze.end", reason: body.reason, environments: names, ...(body.action === "start" ? { hours: body.hours, scope: body.scope } : {}) } });
    } catch { /* best-effort */ }
    try {
      await dispatchWebhookEvent({ organizationId: ctx.organizationId, eventKind: body.action === "start" ? "deployment.freeze_started" : "deployment.freeze_ended", data: { reason: body.reason, environments: names, ...(body.action === "start" ? { scope: body.scope, endsAt: new Date(now.getTime() + body.hours * 3_600_000).toISOString() } : {}) }, fireImmediately: true });
    } catch { /* best-effort: a webhook outage never undoes the freeze */ }
    return NextResponse.json({ ok: true, data: { environments: names, skipped } }, { headers: noStore });
  } catch {
    return fail("freezes_unavailable", 503);
  }
}
