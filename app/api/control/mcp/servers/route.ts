import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId, UserId } from "@/lib/domain/ids";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const MAX_WORKSPACE_MCP_SERVERS = 50;

/**
 * Hosted MCP servers this workspace added from the public MCP registry. Members see the list; owners
 * and admins add, enable, disable and remove. Only the public https endpoint is stored, never
 * credentials. A new server starts disabled until a connection check lists its tools.
 */
async function member() {
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return null;
  return { organizationId: String(c.organizationId), userId: String(c.userId), isAdmin: isAdminOrOwner({ email: c.email, roles: c.roles }) };
}
async function audit(ctx: { organizationId: string; userId: string }, kind: string, id: string, detail: Record<string, unknown>) {
  try { await auditRecord({ organizationId: ctx.organizationId as OrganizationId, actorUserId: ctx.userId as UserId, action: "governance.update", outcome: "success", entityRef: `workspace_mcp_server:${id}`, correlationId: randomUUID() as CorrelationId, detail: { kind, ...detail } }); } catch { /* best-effort */ }
}
const select = { id: true, registryName: true, title: true, version: true, remoteUrl: true, transport: true, enabled: true, lastCheckAt: true, lastCheckOutcome: true, lastCheckDetail: true, toolNames: true, allowedTools: true, createdAt: true } as const;

export async function GET(): Promise<NextResponse> {
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  try {
    const servers = await prisma.workspaceMcpServer.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take: MAX_WORKSPACE_MCP_SERVERS, select });
    return NextResponse.json({ ok: true, data: { canEdit: ctx.isAdmin, servers } }, { headers: noStore });
  } catch { return fail("mcp_servers_unavailable", 503); }
}

const httpsUrl = z.string().trim().max(2048).refine((v) => { try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && !v.includes("{"); } catch { return false; } }, "use an https address without credentials");
const addSchema = z.object({ registryName: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._/-]+$/), title: z.string().trim().min(1).max(200), version: z.string().trim().max(80).nullable().optional(), remoteUrl: httpsUrl, transport: z.enum(["streamable-http", "sse"]) }).strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const body = addSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("invalid_payload", 400);
  try {
    if ((await prisma.workspaceMcpServer.count({ where: { organizationId: ctx.organizationId } })) >= MAX_WORKSPACE_MCP_SERVERS) return fail("mcp_server_limit_reached", 409);
    const row = await prisma.workspaceMcpServer.create({ data: { organizationId: ctx.organizationId, registryName: body.data.registryName, title: body.data.title, version: body.data.version ?? null, remoteUrl: body.data.remoteUrl, transport: body.data.transport, enabled: false, addedByUserId: ctx.userId }, select });
    await audit(ctx, "mcp_server.add", row.id, { registryName: row.registryName, host: new URL(row.remoteUrl).host });
    return NextResponse.json({ ok: true, data: row }, { status: 201, headers: noStore });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return fail("mcp_server_already_added", 409);
    return fail("mcp_servers_unavailable", 503);
  }
}

const patchSchema = z.union([
  z.object({ id: z.string().min(1).max(64), enabled: z.boolean() }).strict(),
  z.object({ id: z.string().min(1).max(64), allowedTools: z.array(z.string().min(1).max(120)).max(200) }).strict(),
]);

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("invalid_payload", 400);
  try {
    const current = await prisma.workspaceMcpServer.findFirst({ where: { id: body.data.id, organizationId: ctx.organizationId }, select: { lastCheckOutcome: true, toolNames: true } });
    if (!current) return fail("mcp_server_not_found", 404);
    if ("allowedTools" in body.data) {
      const allowed = [...new Set(body.data.allowedTools)];
      if (allowed.some((t) => !current.toolNames.includes(t))) return fail("mcp_tool_unknown", 400);
      await prisma.workspaceMcpServer.updateMany({ where: { id: body.data.id, organizationId: ctx.organizationId }, data: { allowedTools: allowed } });
      await audit(ctx, "mcp_server.approve_tools", body.data.id, { allowedTools: allowed });
      return NextResponse.json({ ok: true }, { headers: noStore });
    }
    if (body.data.enabled && current.lastCheckOutcome !== "ok") return fail("mcp_server_check_required", 409);
    await prisma.workspaceMcpServer.updateMany({ where: { id: body.data.id, organizationId: ctx.organizationId }, data: { enabled: body.data.enabled } });
    await audit(ctx, body.data.enabled ? "mcp_server.enable" : "mcp_server.disable", body.data.id, {});
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch { return fail("mcp_servers_unavailable", 503); }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const ctx = await member();
  if (!ctx) return fail("workspace_membership_required", 403);
  if (!ctx.isAdmin) return fail("workspace_admin_required", 403);
  const body = z.object({ id: z.string().min(1).max(64) }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("invalid_payload", 400);
  try {
    const r = await prisma.workspaceMcpServer.deleteMany({ where: { id: body.data.id, organizationId: ctx.organizationId } });
    if (r.count !== 1) return fail("mcp_server_not_found", 404);
    await audit(ctx, "mcp_server.remove", body.data.id, {});
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch { return fail("mcp_servers_unavailable", 503); }
}
