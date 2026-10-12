/**
 * POST /api/billing/portal-session
 *
 * Returns a Stripe Billing Portal URL for the caller's customer.
 * 404-equivalent (typed reason) when the tenant has never completed
 * checkout (no stripeCustomerId).
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { createBillingPortalSession } from "@/lib/billing/stripeHelper";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomError } from "@/lib/errors/axiomErrors";
import { isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    if (!isSelfServiceBillingEnabled()) {
      throw new AxiomError({ code: "billing.portal.disabled", category: "precondition", userMessage: "Self-service billing is not active yet." });
    }
    if (!isSameOriginRequest(req)) {
      throw new AxiomError({ code: "billing.origin.invalid", category: "authorization", userMessage: "This billing request did not come from the Axiom application." });
    }
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.email) {
      throw new AxiomError({ code: "auth.required", category: "authentication", userMessage: "Sign in required." });
    }
    if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
      throw new AxiomError({ code: "billing.admin_required", category: "authorization", userMessage: "A workspace owner or admin must manage billing." });
    }
    const plan = await readBillingPlan(String(ctx.organizationId));
    if (!plan.stripeCustomerId) {
      return apiOk({ ok: false, reason: "No Stripe customer on file — complete an upgrade first." }, {
        correlationId,
        safetyContract: "billing_summary_read_only",
        sourceMode: asApiSourceMode("preview"),
      });
    }
    const origin = process.env.NEXTAUTH_URL?.trim() || req.nextUrl.origin;
    const result = await createBillingPortalSession({
      customerId: plan.stripeCustomerId,
      returnUrl: `${origin}/account?billing=return`,
    });
    return apiOk(result, {
      correlationId,
      safetyContract: "billing_summary_read_only",
      sourceMode: asApiSourceMode(result.ok ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "billing_summary_read_only" });
  }
}
