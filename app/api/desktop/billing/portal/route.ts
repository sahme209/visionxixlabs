import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/api/dtoMappers";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { createBillingPortalSession } from "@/lib/billing/stripeHelper";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const principal = await resolveRequestDesktopSession(request, {
    requiredScope: "release_gate:read",
    route: "/api/desktop/billing/portal",
    requireActiveAccess: false,
  });
  if (!principal || principal.credentialKind !== "desktop_session") {
    return NextResponse.json({ ok: false, error: "desktop_session_required", message: "Sign in to Axiom Agent again to manage billing." }, { status: 401 });
  }

  const plan = await readBillingPlan(principal.organizationId);
  if (!plan.stripeCustomerId) {
    return NextResponse.json({ ok: false, error: "billing_customer_missing", message: "This workspace is not attached to a Stripe billing customer. Contact your workspace administrator." }, { status: 409 });
  }

  const portal = await createBillingPortalSession({
    customerId: plan.stripeCustomerId,
    returnUrl: "https://visionxixlabs.com/desktop/billing/return",
  });
  if (!portal.ok || !portal.url) {
    return NextResponse.json({ ok: false, error: "billing_portal_unavailable", message: portal.reason ?? "The billing portal is unavailable." }, { status: 503 });
  }

  return NextResponse.json(apiSuccess({ url: portal.url }));
}
