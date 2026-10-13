import { NextResponse, type NextRequest } from "next/server";

import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Credit checkout is deliberately fail-closed until its one-time Stripe Price,
 * signed fulfillment webhook, refund reversal, and replay tests are complete.
 * The former implementation created a fake Checkout id and pending ledger row;
 * that looked functional without collecting or verifying payment.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  return NextResponse.json({
    ok: false,
    error: "ai_credit_checkout_not_ready",
    message: "AI credit checkout remains locked until verified Stripe payment fulfillment is enabled.",
  }, { status: 503 });
}
