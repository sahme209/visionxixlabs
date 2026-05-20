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
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const plan = await readBillingPlan(String(ctx.organizationId));
    if (!plan.stripeCustomerId) {
      return apiOk({ ok: false, reason: "No Stripe customer on file — complete an upgrade first." }, {
        correlationId,
        safetyContract: "billing_summary_read_only",
        sourceMode: asApiSourceMode("preview"),
      });
    }
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const result = await createBillingPortalSession({
      customerId: plan.stripeCustomerId,
      returnUrl: `${origin}/dashboard/billing`,
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
