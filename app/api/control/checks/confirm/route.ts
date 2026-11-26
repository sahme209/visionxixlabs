import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/lib/prismaClient";
import { currentContext } from "@/lib/auth/currentContext";
import { canDecideApprovals } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status, headers: noStore });

const bodySchema = z.object({
  checkKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  checkVersion: z.number().int().positive(),
  commitSha: z.string().regex(/^[0-9a-f]{40}$/, "use the full 40-character commit SHA"),
  confirmedItems: z.array(z.string().max(300)).min(1).max(25),
}).strict();

/**
 * POST: a person confirms every item of a manual checklist for one exact commit. Recorded as the
 * check's result (reporter = the confirming user), so the deployment gate can use it. Approvers only.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return fail("workspace_membership_required", 403);
  if (!canDecideApprovals({ email: c.email, roles: c.roles })) return fail("approver_role_required", 403);
  const text = await request.text();
  if (text.length > 16 * 1024) return fail("payload_too_large", 413);
  let raw: unknown; try { raw = JSON.parse(text); } catch { return fail("invalid_payload", 400); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_payload", 400, { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const organizationId = String(c.organizationId), userId = String(c.userId), b = parsed.data;
  try {
    const check = await prisma.deploymentCheck.findFirst({ where: { organizationId, key: b.checkKey }, select: { kind: true, stage: true, version: true, spec: true, enabled: true } });
    if (!check || check.kind !== "manual_checklist") return fail("checklist_not_found", 404);
    if (check.version !== b.checkVersion) return fail("check_changed", 409, { detail: "The checklist changed after you loaded it. Reload and confirm the current items." });
    const items = (check.spec as { items?: unknown }).items;
    const expected = Array.isArray(items) ? items.filter((i): i is string => typeof i === "string") : [];
    if (expected.length === 0 || expected.length !== b.confirmedItems.length || expected.some((item, i) => item !== b.confirmedItems[i])) return fail("items_not_all_confirmed", 422);
    try {
      await prisma.deploymentCheckResult.create({ data: { organizationId, checkKey: b.checkKey, checkVersion: check.version, stage: check.stage, status: "passed", releaseRef: b.commitSha, idempotencyKey: `manual:${b.commitSha}:${b.checkKey}:v${check.version}`, apiKeyId: `user:${userId}` } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ ok: true, recorded: false, duplicate: true }, { headers: noStore });
      throw err;
    }
    try {
      await auditRecord({ organizationId: organizationId as OrganizationId, actorUserId: userId as UserId, action: "approval.grant", outcome: "success", entityRef: `deployment_check:${b.checkKey}`, correlationId: randomUUID() as CorrelationId, detail: { kind: "manual_checklist_confirmed", commitSha: b.commitSha, version: check.version, items: expected.length } });
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, recorded: true }, { status: 201, headers: noStore });
  } catch {
    return fail("checks_unavailable", 503);
  }
}
