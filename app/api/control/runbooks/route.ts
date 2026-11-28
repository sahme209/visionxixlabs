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
import { MAX_RUNBOOKS, validateRunbook } from "@/lib/releaseops/runbookLibrary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });
const select = { key: true, title: true, trigger: true, steps: true, enabled: true, version: true, updatedAt: true } as const;

async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }) };
}

/** GET: the workspace's runbooks. Members can read. */
export async function GET(): Promise<NextResponse> {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const runbooks = await prisma.workspaceRunbook.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { key: "asc" }, take: MAX_RUNBOOKS, select });
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, runbooks } }, { headers: noStore });
  } catch {
    return fail("runbooks_unavailable", 503);
  }
}

const envelope = z.object({ runbook: z.unknown(), expectedVersion: z.number().int().positive().optional() }).strict();

/** POST: create a runbook, or update it when expectedVersion matches. Owners and admins. Never runs anything. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const text = await request.text();
  if (text.length > 96 * 1024) return fail("payload_too_large", 413);
  let raw: unknown; try { raw = JSON.parse(text); } catch { return fail("invalid_payload", 400); }
  const env = envelope.safeParse(raw);
  if (!env.success) return fail("invalid_payload", 400);
  const valid = validateRunbook(env.data.runbook);
  if (!valid.ok) return fail("runbook_invalid", 422, { issues: valid.errors });
  const r = valid.runbook;
  const data = { title: r.title, trigger: r.trigger, steps: r.steps as unknown as Prisma.InputJsonValue, enabled: r.enabled, updatedByUserId: ctx.userId };
  try {
    let version: number;
    if (env.data.expectedVersion === undefined) {
      if ((await prisma.workspaceRunbook.count({ where: { organizationId: ctx.organizationId } })) >= MAX_RUNBOOKS) return fail("runbook_limit_reached", 409);
      try { await prisma.workspaceRunbook.create({ data: { organizationId: ctx.organizationId, key: r.key, ...data } }); }
      catch (err) { if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return fail("runbook_exists", 409); throw err; }
      version = 1;
    } else {
      const res = await prisma.workspaceRunbook.updateMany({ where: { organizationId: ctx.organizationId, key: r.key, version: env.data.expectedVersion }, data: { ...data, version: { increment: 1 } } });
      if (res.count !== 1) return fail("runbook_changed", 409);
      version = env.data.expectedVersion + 1;
    }
    try { await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: `runbook:${r.key}`, correlationId: randomUUID() as CorrelationId, detail: { kind: version === 1 ? "runbook.create" : "runbook.update", key: r.key, version } }); } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, data: { key: r.key, version } }, { status: version === 1 ? 201 : 200, headers: noStore });
  } catch {
    return fail("runbooks_unavailable", 503);
  }
}
