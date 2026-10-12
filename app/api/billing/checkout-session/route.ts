/**
 * POST /api/billing/checkout-session
 *
 * Body: { planId: "pro" | "enterprise", billingInterval: "monthly" | "annual" }
 *
 * Returns a Stripe Checkout URL when Stripe is configured. Returns
 * an honest `{ ok: false, reason }` when it isn't — callers render
 * the reason in the upgrade UI instead of crashing.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { createCheckoutSession } from "@/lib/billing/stripeHelper";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomError, AxiomErrors } from "@/lib/errors/axiomErrors";
import {
  isBillingInterval,
  isPaidPublicPlanId,
  isSelfServiceBillingEnabled,
} from "@/lib/billing/publicPlanCatalog";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    if (!isSelfServiceBillingEnabled()) {
      throw new AxiomError({ code: "billing.checkout.disabled", category: "precondition", userMessage: "Self-service billing is not active yet." });
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
    const body = (await req.json()) as { planId?: string; billingInterval?: string } | null;
    if (!body?.planId || !isPaidPublicPlanId(body.planId)) {
      throw AxiomErrors.validation("billing.plan.invalid", "planId must be pro or enterprise.");
    }
    const billingInterval = body.billingInterval ?? "monthly";
    if (!isBillingInterval(billingInterval)) {
      throw AxiomErrors.validation("billing.interval.invalid", "billingInterval must be monthly or annual.");
    }

    const seatCount = Math.max(1, await prisma.orgMembership.count({
      where: { organizationId: String(ctx.organizationId), acceptedAt: { not: null } },
    }));

    const origin = process.env.NEXTAUTH_URL?.trim() || req.nextUrl.origin;
    const result = await createCheckoutSession({
      organizationId: String(ctx.organizationId),
      email: ctx.email,
      planId: body.planId,
      billingInterval,
      seatCount,
      successUrl: `${origin}/account?billing=success`,
      cancelUrl: `${origin}/plans?checkout=canceled`,
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
