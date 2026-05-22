/**
 * POST /api/billing/add-ons/purchase — Phase 386.
 *
 * Initiates an add-on purchase. The real implementation creates a
 * Stripe Checkout Session and returns the URL for the client to
 * redirect to. Until Stripe Checkout for add-ons is wired (operator
 * needs to create price IDs in the Stripe Dashboard), this route is
 * a STUB that:
 *
 *   - Validates the sku is in the catalog
 *   - Validates the sku is allowed for the workspace's plan
 *   - Inserts an AddOnPurchase row with status="pending" and a stub
 *     stripeCheckoutSessionId so the audit trail and history surface
 *     work end-to-end
 *   - Returns a fake checkoutUrl that points back to the usage page
 *
 * Once the Stripe price IDs land (STRIPE_PRICE_ADDON_* env vars), the
 * route swaps the stub for a real stripe.checkout.sessions.create().
 *
 * Audit: billing.addon_purchase_initiated.
 *
 * Body: { sku: string }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { planForStripeTier } from "@/lib/billing/planRegistry";
import { findAddOn, findAddOnsForPlan } from "@/lib/billing/addOnCatalog";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function POST(req: NextRequest) {
  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }
  const orgId = String(session.organizationId);
  const purchasedBy = session.userId ?? session.email ?? "unknown";

  let body: { sku?: unknown } = {};
  try { body = await req.json() as typeof body; } catch { /* empty */ }
  const sku = body.sku;
  if (typeof sku !== "string" || sku.length === 0) {
    return NextResponse.json({ ok: false, reason: "invalid_body", detail: "sku required" }, { status: 400 });
  }

  const addOn = findAddOn(sku);
  if (!addOn) {
    return NextResponse.json({ ok: false, reason: "unknown_sku" }, { status: 404 });
  }

  const billing = await readBillingPlan(orgId).catch(() => null);
  const plan = planForStripeTier(billing?.tier);
  const allowed = findAddOnsForPlan(plan).some((a) => a.sku === sku);
  if (!allowed) {
    return NextResponse.json({
      ok: false,
      reason: "sku_not_available_on_plan",
      detail: `${addOn.displayName} is not available on the ${plan.displayName} plan.`,
    }, { status: 403 });
  }

  const period = periodKey(new Date());
  const correlationId = `addon_${sku}_${orgId}_${Date.now().toString(36)}`;
  const stubSessionId = `cs_stub_${correlationId}`;

  let purchaseId: string | null = null;
  try {
    const created = await prisma.addOnPurchase.create({
      data: {
        organizationId: orgId,
        sku,
        pricePaidCents: addOn.priceCents,
        deliveredAICreditsCents: addOn.deliveredAICreditsCents,
        deliveredSeats: addOn.deliveredSeats,
        deliveredConnectors: addOn.deliveredConnectors,
        validFor: addOn.validFor,
        periodMonth: period,
        status: "pending",
        stripeCheckoutSessionId: stubSessionId,
        purchasedBy,
        correlationId,
      },
    });
    purchaseId = created.id;
  } catch {
    return NextResponse.json({
      ok: false,
      reason: "persist_failed",
      detail: "Could not initiate add-on purchase. Retry.",
    }, { status: 500 });
  }

  try {
    await recordAudit({
      organizationId: idFactory.organization(orgId),
      actorUserId: session.userId ? session.userId : idFactory.user(session.email ?? "unknown"),
      actorKind: "user",
      action: "billing.addon_purchase_initiated",
      outcome: "success",
      entityRef: `addon_purchase:${purchaseId}`,
      correlationId: idFactory.correlation(correlationId),
      source: "live",
      detail: {
        sku,
        priceCents: addOn.priceCents,
        deliveredAICreditsCents: addOn.deliveredAICreditsCents,
        deliveredSeats: addOn.deliveredSeats,
        deliveredConnectors: addOn.deliveredConnectors,
        validFor: addOn.validFor,
        planTier: plan.tier,
        periodMonth: period,
      },
    });
  } catch { /* best-effort */ }

  // Stub path — real Stripe Checkout Session creation lands when the
  // STRIPE_PRICE_ADDON_* env vars exist in production. Until then we
  // return a "/dashboard/billing/add-ons?stub=success" link the client
  // can render as a redirect placeholder.
  return NextResponse.json({
    ok: true,
    purchaseId,
    sku,
    pricePaidCents: addOn.priceCents,
    status: "pending",
    checkoutUrl: `/dashboard/billing/add-ons?initiated=${purchaseId}`,
    stub: true,
  });
}
