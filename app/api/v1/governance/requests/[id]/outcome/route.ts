/**
 * POST /api/v1/governance/requests/{id}/outcome — agent governance gateway (A10).
 * After acting, the agent reports { outcome: succeeded|failed|abandoned, detail? }.
 * Only for allowed or approved requests, once. Scope: governance:request.
 */
import { NextResponse, type NextRequest } from "next/server";
import { gatewayAuth, noStore } from "@/lib/agentGateway/apiAuth";
import { recordGatewayOutcome } from "@/lib/agentGateway/gatewayService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await gatewayAuth(req, "governance:request", "POST /api/v1/governance/requests/[id]/outcome");
  if ("response" in auth) return auth.response;
  const result = await recordGatewayOutcome(auth.caller, (await ctx.params).id, await req.json().catch(() => null));
  return result.ok ? NextResponse.json({ ok: true, request: result.request }, noStore) : NextResponse.json({ ok: false, error: result.error }, { status: result.status });
}
