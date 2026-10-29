import { publicBillingPolicyEnabled } from "@/lib/billing/publicBillingConfig";
import { publicBillingRuntime } from "@/lib/billing/publicBillingRuntime";
import { ownedCheckoutPost } from "@/lib/billing/ownedCheckoutBridge/http";
/**
 * POST /api/billing/checkout-session
 *
 * Body: { planId: "pro" | "enterprise", billingInterval: "monthly" | "annual", expectedOrganizationId: string }
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
  const owned = await ownedCheckoutPost(req);
  if (owned) return owned;
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
    const body = (await req.json()) as { planId?: string; billingInterval?: string; expectedOrganizationId?: unknown } | null;
    if (!body?.planId || !isPaidPublicPlanId(body.planId)) {
      throw AxiomErrors.validation("billing.plan.invalid", "planId must be pro or enterprise.");
    }
    const billingInterval = body.billingInterval ?? "monthly";
    if (!isBillingInterval(billingInterval)) {
      throw AxiomErrors.validation("billing.interval.invalid", "billingInterval must be monthly or annual.");
    }

    // Bind this explicit purchase to the workspace shown to the customer.
    // A stale tab must never silently purchase for a newly selected workspace.
    if (typeof body.expectedOrganizationId !== "string" || body.expectedOrganizationId !== String(ctx.organizationId)) {
      throw new AxiomError({ code: "billing.workspace_changed", category: "authorization", userMessage: "Your workspace changed or could not be confirmed. Refresh the plans page and review your selection before trying again." });
    }

    if (publicBillingPolicyEnabled()) {
      if (!ctx.userId) throw new AxiomError({code:"auth.required",category:"authentication",userMessage:"Sign in required."});
      const canonical = new URL(process.env.NEXTAUTH_URL?.trim() || req.nextUrl.origin);
      if (canonical.protocol !== "https:" || canonical.origin !== req.nextUrl.origin || canonical.username || canonical.password) {
        throw new AxiomError({code:"billing.origin.invalid",category:"authorization",userMessage:"Open billing on the application's secure canonical website."});
      }
      const runtime = await publicBillingRuntime();
      const result = await runtime.service.checkout({organizationId:String(ctx.organizationId),userId:String(ctx.userId)}, {
        planId:body.planId,interval:billingInterval,email:ctx.email,
        successUrl:`${canonical.origin}/control/usage-billing?billing=success`,cancelUrl:`${canonical.origin}/plans?checkout=canceled`,
      });
      if(result.kind==="checkout_expired") return new Response(JSON.stringify({ok:false,error:{code:"billing.checkout.expired",userMessage:"Your previous unpaid checkout expired. Review your selection and click again to start a new checkout."},meta:{correlationId}}),{status:409,headers:{"content-type":"application/json"}});
      if(result.kind!=="checkout_ready") return new Response(JSON.stringify({ok:false,error:{code:"billing.reconciliation_required",userMessage:"Your previous purchase is being verified. No new charge was started. Please check Usage & billing or contact support."},meta:{correlationId}}),{status:409,headers:{"content-type":"application/json"}});
      return apiOk({ok:true,url:result.url},{correlationId,safetyContract:"billing_summary_read_only",sourceMode:asApiSourceMode("live")});
    }
    if (process.env.AXIOM_STRIPE_MODE === "live") throw new AxiomError({code:"billing.fulfillment.not_ready",category:"precondition",userMessage:"Verified subscription fulfillment is not active yet."});

    // The existing event consumer refuses replacement subscription identities.
    // Starting another paid subscription cannot implement an upgrade, renewal,
    // or canceled-account recovery until that lifecycle is reviewed.
    const existing = await prisma.tenantBillingPlan.findUnique({
      where: { organizationId: String(ctx.organizationId) },
      select: { stripeCustomerId: true, stripeSubscriptionId: true },
    });
    if (existing?.stripeCustomerId || existing?.stripeSubscriptionId) {
      throw new AxiomError({ code: "billing.subscription_change_required", category: "precondition", userMessage: "This workspace already has a billing record. Review Usage & billing or contact support before starting a subscription change." });
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
      successUrl: `${origin}/control/usage-billing?billing=success`,
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
