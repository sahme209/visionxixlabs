import { NextResponse, type NextRequest } from "next/server";

import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { prisma } from "@/lib/db";
import { findAddOn } from "@/lib/billing/addOnCatalog";
import { createAddOnCheckoutSession } from "@/lib/billing/stripeHelper";
import { isSelfServiceBillingEnabled } from "@/lib/billing/publicPlanCatalog";
import { resolveCorrelationId } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers);
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
  if (!isSelfServiceBillingEnabled()) {
    return NextResponse.json({ ok: false, error: "billing_disabled" }, { status: 503 });
  }
  if (!context.email) {
    return NextResponse.json({ ok: false, error: "billing_email_required" }, { status: 400 });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) {
    return NextResponse.json({ ok: false, error: "idempotency_key_required" }, { status: 400 });
  }
  const body = await request.json().catch(() => null) as { sku?: unknown; organizationId?: unknown } | null;
  if (body?.organizationId !== undefined && body.organizationId !== context.organizationId) {
    return NextResponse.json({ ok: false, error: "workspace_changed" }, { status: 409 });
  }
  const addOn = typeof body?.sku === "string" ? findAddOn(body.sku) : null;
  if (!addOn || addOn.category !== "ai_credits") {
    return NextResponse.json({ ok: false, error: "ai_credit_sku_invalid" }, { status: 400 });
  }

  const periodMonth = new Date().toISOString().slice(0, 7);
  let purchase;
  let newlyCreated = false;
  try {
    purchase = await prisma.addOnPurchase.create({
      data: {
        organizationId: context.organizationId,
        sku: addOn.sku,
        pricePaidCents: addOn.priceCents,
        deliveredAICreditsCents: addOn.deliveredAICreditsCents,
        deliveredSeats: 0,
        deliveredConnectors: 0,
        validFor: addOn.validFor,
        periodMonth,
        status: "pending",
        purchasedBy: context.userId,
        correlationId,
        idempotencyKey,
      },
    });
    newlyCreated = true;
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
      return NextResponse.json({ ok: false, error: "billing_storage_unavailable" }, { status: 503 });
    }
    try {
      purchase = await prisma.addOnPurchase.findUnique({ where: { organizationId_idempotencyKey: { organizationId: context.organizationId, idempotencyKey } } });
    } catch {
      return NextResponse.json({ ok: false, error: "billing_storage_unavailable" }, { status: 503 });
    }
    if (!purchase) return NextResponse.json({ ok: false, error: "billing_storage_unavailable" }, { status: 503 });
  }
  if (purchase.sku !== addOn.sku || purchase.organizationId !== context.organizationId) {
    return NextResponse.json({ ok: false, error: "idempotency_key_conflict" }, { status: 409 });
  }
  if (purchase.status !== "pending") {
    return NextResponse.json({ ok: false, error: "purchase_already_finalized", purchaseStatus: purchase.status }, { status: 409 });
  }

  // Stripe may prune idempotency keys after at least 24 hours. Never create
  // another session for an older or unbound uncertain intent. The existing
  // row does not snapshot email/URLs/displayName, so even a recent retry cannot
  // prove exact original request compatibility: reconciliation is required.
  const createdAt = purchase.createdAt instanceof Date ? purchase.createdAt.getTime() : NaN;
  const age = Date.now() - createdAt;
  if (!Number.isFinite(age) || age < 0 || age >= 23 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: false, error: "checkout_reconciliation_required" }, { status: 409 });
  }
  if (!newlyCreated) {
    return NextResponse.json({ ok: false, error: "checkout_reconciliation_required" }, { status: 409 });
  }
  if (purchase.pricePaidCents !== addOn.priceCents || purchase.deliveredAICreditsCents !== addOn.deliveredAICreditsCents || purchase.validFor !== addOn.validFor) {
    return NextResponse.json({ ok: false, error: "checkout_reconciliation_required" }, { status: 409 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
  const checkout = await createAddOnCheckoutSession({
    purchaseId: purchase.id,
    organizationId: context.organizationId,
    email: context.email,
    sku: addOn.sku,
    displayName: addOn.displayName,
    priceCents: purchase.pricePaidCents,
    idempotencyKey: `ai-credit:${context.organizationId}:${idempotencyKey}`,
    successUrl: `${origin}/control/usage-billing?credit_checkout=success`,
    cancelUrl: `${origin}/control/usage-billing?credit_checkout=cancelled`,
  });
  if (!checkout.ok || !checkout.url || !checkout.sessionId) {
    if (!checkout.ok && checkout.outcome === "not_dispatched") {
      await prisma.addOnPurchase.updateMany({
        where: { id: purchase.id, status: "pending", stripeCheckoutSessionId: null },
        data: { status: "failed" },
      }).catch(() => undefined);
    }
    // A timeout/invalid provider response can conceal a real Checkout session.
    // Preserve pending intent so a later verified paid webhook can fulfill it.
    return NextResponse.json(
      { ok: false, error: "stripe_checkout_unavailable", message: !checkout.ok && checkout.outcome === "not_dispatched"
        ? "Checkout was not started. Check this purchase before starting another."
        : "Checkout outcome is uncertain. Keep this purchase reference and contact support; do not start another purchase." },
      { status: 503 },
    );
  }
  try {
    await prisma.addOnPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: checkout.sessionId },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "billing_storage_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, url: checkout.url });
}
