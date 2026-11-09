/**
 * POST /api/agent-gateway/requests/{id}/decision
 * Body: { organizationId, decision: "approve" | "reject", note? }
 * A workspace owner/admin decides an agent's pending request (A10). The person
 * who minted the agent's API key cannot approve its requests.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { decideGatewayRequest } from "@/lib/agentGateway/gatewayService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null } | undefined;
  if (!user?.id) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const body = await req.json().catch(() => null) as { organizationId?: unknown; decision?: unknown; note?: unknown } | null;
  if (!await authorizedForOrganization(user.id, body?.organizationId, true)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const result = await decideGatewayRequest({ organizationId: body!.organizationId as string, userId: user.id, userEmail: user.email ?? null, id: (await ctx.params).id, decision: body?.decision, note: body?.note });
  return result.ok ? NextResponse.json({ ok: true, request: result.request }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ ok: false, error: result.error }, { status: result.status });
}
