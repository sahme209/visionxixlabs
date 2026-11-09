/**
 * GET /api/v1/governance/requests/{id} — agent governance gateway (A10).
 * Returns the request's status and `mayProceed`. Only the API key that created
 * the request can read it. Scope: governance:read.
 */
import { NextResponse, type NextRequest } from "next/server";
import { gatewayAuth, noStore } from "@/lib/agentGateway/apiAuth";
import { getGatewayRequest } from "@/lib/agentGateway/gatewayService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await gatewayAuth(req, "governance:read", "GET /api/v1/governance/requests/[id]");
  if ("response" in auth) return auth.response;
  const request = await getGatewayRequest(auth.caller, (await ctx.params).id);
  return request ? NextResponse.json({ ok: true, request }, noStore) : NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
}
