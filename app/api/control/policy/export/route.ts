import { NextResponse } from "next/server";
import { exportPolicyDocument } from "@/lib/releaseops/policyAsCode";
import { policyAdminContext, readAutopilot, readPolicyRules } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET: the workspace's policy rules as a canonical document for Git. Read-only; owners and admins. */
export async function GET() {
  const context = await policyAdminContext();
  if (!context) return NextResponse.json({ ok: false, error: "workspace_admin_required" }, { status: 403 });
  try {
    const [rules, autopilot] = await Promise.all([readPolicyRules(context.organizationId), readAutopilot(context.organizationId)]);
    const body = exportPolicyDocument(rules, autopilot);
    return new NextResponse(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="v19-policy.json"', "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_export_unavailable" }, { status: 503 });
  }
}
