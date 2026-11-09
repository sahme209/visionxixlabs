/**
 * POST /api/v1/governance/check — agent governance gateway (A10).
 * Ask "may an agent do this?" without storing anything. Scope: governance:read.
 * Body: { actionKind, environment?, target, summary, agentName? }
 * → { ok: true, policy: { decision: allow|require_approval|deny, riskLevel, reasons[] } }
 */
import { NextResponse, type NextRequest } from "next/server";
import { gatewayAuth, noStore } from "@/lib/agentGateway/apiAuth";
import { checkPolicy } from "@/lib/agentGateway/gatewayService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await gatewayAuth(req, "governance:read", "POST /api/v1/governance/check");
  if ("response" in auth) return auth.response;
  const result = checkPolicy(await req.json().catch(() => null));
  return result.ok ? NextResponse.json({ ok: true, policy: result.policy }, noStore) : NextResponse.json(result, { status: 400 });
}
