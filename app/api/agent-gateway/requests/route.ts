/**
 * GET /api/agent-gateway/requests?organizationId=...&status=pending
 * Workspace members list agent gateway requests (A10). Session auth.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { listGatewayRequests } from "@/lib/agentGateway/gatewayService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!await authorizedForOrganization(userId, organizationId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const requests = await listGatewayRequests(organizationId as string, req.nextUrl.searchParams.get("status") ?? undefined);
  return NextResponse.json({ ok: true, requests }, { headers: { "Cache-Control": "no-store" } });
}
