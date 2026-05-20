/**
 * POST /api/billing/checkout-session
 *
 * Body: { tier: "starter" | "growth" | "enterprise" }
 *
 * Returns a Stripe Checkout URL when Stripe is configured. Returns
 * an honest `{ ok: false, reason }` when it isn't — callers render
 * the reason in the upgrade UI instead of crashing.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { createCheckoutSession } from "@/lib/billing/stripeHelper";
import { isBillingTier } from "@/lib/billing/tierCatalog";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.email) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = (await req.json()) as { tier?: string } | null;
    if (!body?.tier || !isBillingTier(body.tier) || body.tier === "trial") {
      throw AxiomErrors.validation("billing.tier.invalid", "tier must be starter | growth | enterprise.");
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const result = await createCheckoutSession({
      organizationId: String(ctx.organizationId),
      email: ctx.email,
      tier: body.tier,
      successUrl: `${origin}/dashboard/billing?upgraded=1`,
      cancelUrl: `${origin}/dashboard/billing?canceled=1`,
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
