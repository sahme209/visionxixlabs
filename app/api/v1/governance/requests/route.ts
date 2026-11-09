/**
 * POST /api/v1/governance/requests — agent governance gateway (A10).
 * An agent asks for approval of one exact action. Scope: governance:request.
 * Low-risk actions are allowed immediately; denied actions are refused; the
 * rest wait for a workspace admin. Poll GET /api/v1/governance/requests/{id}.
 */
import { NextResponse, type NextRequest } from "next/server";
import { gatewayAuth, noStore } from "@/lib/agentGateway/apiAuth";
import { createGatewayRequest } from "@/lib/agentGateway/gatewayService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await gatewayAuth(req, "governance:request", "POST /api/v1/governance/requests");
  if ("response" in auth) return auth.response;
  const result = await createGatewayRequest(auth.caller, await req.json().catch(() => null));
  return result.ok ? NextResponse.json({ ok: true, request: result.request }, { status: 201, ...noStore }) : NextResponse.json(result, { status: 400 });
}
