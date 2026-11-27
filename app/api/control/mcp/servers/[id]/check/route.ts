import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";
import { checkMcpServer } from "@/lib/integrations/mcp/mcpConnectionCheck";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
const noStore = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: noStore });
const MIN_INTERVAL_MS = 30_000;

/**
 * Runs a connection check on one of the workspace's MCP servers: initialize and list tools, with no
 * credentials and no tool calls. Owners and admins only, at most once every 30 seconds per server.
 * A server that no longer passes is disabled.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) return fail("cross_origin_refused", 403);
  const c = await currentContext();
  if (!c.isAuthenticated || !c.organizationId || !c.userId || !c.roles.length) return fail("workspace_membership_required", 403);
  if (!isAdminOrOwner({ email: c.email, roles: c.roles })) return fail("workspace_admin_required", 403);
  const { id } = await params;
  if (!id || id.length > 64) return fail("mcp_server_not_found", 404);
  const organizationId = String(c.organizationId);
  try {
    const server = await prisma.workspaceMcpServer.findFirst({ where: { id, organizationId }, select: { remoteUrl: true, lastCheckAt: true, allowedTools: true } });
    if (!server) return fail("mcp_server_not_found", 404);
    if (server.lastCheckAt && Date.now() - server.lastCheckAt.getTime() < MIN_INTERVAL_MS) return fail("check_rate_limited", 429);
    await prisma.workspaceMcpServer.updateMany({ where: { id, organizationId }, data: { lastCheckAt: new Date() } });
    const result = await checkMcpServer(server.remoteUrl);
    await prisma.workspaceMcpServer.updateMany({ where: { id, organizationId }, data: { lastCheckAt: new Date(), lastCheckOutcome: result.outcome, lastCheckDetail: result.detail.slice(0, 300), toolNames: result.tools, allowedTools: server.allowedTools.filter((t) => result.tools.includes(t)), ...(result.outcome === "ok" ? {} : { enabled: false }) } });
    return NextResponse.json({ ok: true, data: result }, { headers: noStore });
  } catch { return fail("mcp_check_unavailable", 503); }
}
