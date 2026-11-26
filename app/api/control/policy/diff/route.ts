import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { diffPolicy, parsePolicyDocument } from "@/lib/releaseops/policyAsCode";
import { policyAdminContext, readPolicyRules } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BYTES = 256 * 1024;

/** POST: compare a proposed policy document with the current rules. Never writes rules. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "cross_origin_refused" }, { status: 403 });
  const context = await policyAdminContext();
  if (!context) return NextResponse.json({ ok: false, error: "workspace_admin_required" }, { status: 403 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "policy_document_too_large" }, { status: 413 });
  const parsed = parsePolicyDocument(text);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: "policy_document_invalid", issues: parsed.errors }, { status: 422 });
  try {
    const diff = diffPolicy(await readPolicyRules(context.organizationId), parsed.document);
    return NextResponse.json({ ok: true, data: diff }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_rules_unavailable" }, { status: 503 });
  }
}
