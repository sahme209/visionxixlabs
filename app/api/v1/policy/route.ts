/**
 * GET /api/v1/policy
 * The workspace's policy file (rules and release autopilot) exactly as the cockpit exports it, with its
 * digest. Terraform reads it to plan. Auth: API key with policy:propose. Writes: none.
 */
import { NextResponse, type NextRequest } from "next/server";
import { exportPolicyDocument, policyDigest } from "@/lib/releaseops/policyAsCode";
import { readAutopilot, readPolicyRules } from "@/app/api/control/policy/shared";
import { noStore, policyKey } from "./shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const key = await policyKey(req, "GET /api/v1/policy");
  if (!key.ok) return key.response;
  try {
    const [rules, autopilot] = await Promise.all([readPolicyRules(key.organizationId), readAutopilot(key.organizationId)]);
    return NextResponse.json({ ok: true, document: JSON.parse(exportPolicyDocument(rules, autopilot)), digest: await policyDigest(rules, autopilot) }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_unavailable" }, { status: 503, headers: noStore });
  }
}
