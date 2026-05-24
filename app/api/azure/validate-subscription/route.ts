/**
 * POST /api/azure/validate-subscription
 *
 * Lightweight onboarding-side check that confirms a customer-supplied
 * Azure subscription id + tenant id are well-formed before we record
 * the connection. No platform-side Azure SDK calls — the customer
 * already authorized us via the portal's role-assignment flow, so we
 * just want to land a well-shaped record and advance to scan.
 *
 * Body:  { subscriptionId, tenantId }
 * Reply: { ok: true, subscriptionId, tenantId }
 *      | { ok: false, error, hint }
 *
 * Customer-honest errors. Never mentions env-vars / operator config.
 */

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const GUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface Body {
  subscriptionId?: unknown;
  tenantId?: unknown;
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* empty body */ }
  const subscriptionId = typeof body.subscriptionId === "string" ? body.subscriptionId.trim() : "";
  const tenantId       = typeof body.tenantId       === "string" ? body.tenantId.trim()       : "";

  if (!subscriptionId || !GUID.test(subscriptionId)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_subscription_id",
      hint: "Subscription ID should be a GUID like 00000000-0000-0000-0000-000000000000. Find it on the Azure portal's deployment success page.",
    }, { status: 400 });
  }
  if (!tenantId || !GUID.test(tenantId)) {
    return NextResponse.json({
      ok: false,
      error: "malformed_tenant_id",
      hint: "Tenant ID should be a GUID. It's listed next to your Subscription ID on the Azure deployment success page.",
    }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    subscriptionId,
    tenantId,
  }, { status: 200 });
}
