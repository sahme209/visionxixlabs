import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";
import { normalizeEventKinds } from "@/lib/webhooks/webhookEventKinds";
import { validateWebhookUrl } from "@/lib/webhooks/selectDeliveriesForEvent";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const MAX_ENDPOINTS = 20;

/**
 * Self-serve outbound webhooks for workspace owners and admins. HTTPS and public hosts only. The signing
 * secret is generated here and returned once on creation; afterwards it is never shown. Members can see
 * the list; only owners and admins create or revoke.
 */
async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), email: c.email ?? null, isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }) };
}
async function audit(ctx: { organizationId: string; userId: string }, kind: string, id: string, detail: Record<string, unknown>) {
  try { await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: `webhook_endpoint:${id}`, correlationId: randomUUID() as CorrelationId, detail: { kind, ...detail } }); } catch { /* best-effort */ }
}

export async function GET(): Promise<NextResponse> {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({ where: { organizationId: ctx.organizationId, revokedAt: null }, orderBy: { createdAt: "desc" }, take: MAX_ENDPOINTS, select: { id: true, name: true, url: true, subscribedEvents: true, consecutiveFailures: true, createdAt: true } });
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, endpoints } }, { headers: noStore });
  } catch {
    return fail("webhooks_unavailable", 503);
  }
}

const createSchema = z.object({ name: z.string().trim().min(1).max(80), url: z.string().trim().min(1).max(2048), events: z.array(z.string().max(80)).min(1).max(40) }).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_payload", 400);
  const events = normalizeEventKinds(parsed.data.events);
  if (!events.length) return fail("no_valid_events", 400);
  const urlCheck = validateWebhookUrl(parsed.data.url, { allowHttp: false, allowPrivate: false });
  if (!urlCheck.ok) return fail(`url_${urlCheck.reason}`, 400);
  try {
    if ((await prisma.webhookEndpoint.count({ where: { organizationId: ctx.organizationId, revokedAt: null } })) >= MAX_ENDPOINTS) return fail("webhook_limit_reached", 409);
    // Governance M04: a new outbound destination waits while the workspace is enrolled.
    if (!await workspaceUnenrolled(ctx.organizationId)) return fail("governance_enrolled_destination_increase", 409);
    const secret = randomBytes(32).toString("hex");
    const row = await prisma.webhookEndpoint.create({ data: { organizationId: ctx.organizationId, name: parsed.data.name, url: parsed.data.url, secret, subscribedEvents: events as unknown as object, createdBy: ctx.email ?? ctx.userId }, select: { id: true, name: true, url: true, createdAt: true } });
    await audit(ctx, "webhook.create", row.id, { url: row.url, events });
    return NextResponse.json({ ok: true, data: { ...row, subscribedEvents: events, secret } }, { status: 201, headers: noStore });
  } catch {
    return fail("webhooks_unavailable", 503);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const parsed = z.object({ id: z.string().min(1).max(64) }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("invalid_payload", 400);
  try {
    const r = await prisma.webhookEndpoint.updateMany({ where: { id: parsed.data.id, organizationId: ctx.organizationId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "revoked_by_workspace_admin" } });
    if (r.count !== 1) return fail("webhook_not_found", 404);
    await audit(ctx, "webhook.revoke", parsed.data.id, {});
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return fail("webhooks_unavailable", 503);
  }
}
