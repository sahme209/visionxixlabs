/**
 * GET /api/admin/plan-debug — Admin only.
 * Returns current user plan, derived entitlements, last Stripe webhook event id (no PII).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const session = auth.user;
    const user =
      (await prisma.user.findUnique({
        where: { id: session.uid },
        select: { plan: true },
      })) ??
      (session.email
        ? await prisma.user.findUnique({
            where: { email: session.email },
            select: { plan: true },
          })
        : null);
    const plan = user?.plan ?? null;
    const entitlements = getEntitlementsFromPlan(plan);

    const lastStripeEvent = await prisma.auditLog.findFirst({
      where: { action: "stripe_webhook_processed" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true, createdAt: true },
    });
    const lastStripeEventId =
      (lastStripeEvent?.metadata as { stripeEventId?: string } | null)?.stripeEventId ?? null;

    const envConfigured = {
      STRIPE_PRICES_STARTER: !!(process.env.STRIPE_PRICES_STARTER ?? "").trim(),
      STRIPE_PRICES_GROWTH: !!(process.env.STRIPE_PRICES_GROWTH ?? "").trim(),
      STRIPE_PRICES_SCALE: !!(process.env.STRIPE_PRICES_SCALE ?? "").trim(),
      STRIPE_PRICES_ENTERPRISE: !!(process.env.STRIPE_PRICES_ENTERPRISE ?? "").trim(),
    };

    return NextResponse.json({
      plan,
      entitlements: {
        axiomScan: entitlements.axiomScan,
        axiomExecution: entitlements.axiomExecution,
        cloudConnectors: entitlements.cloudConnectors,
        operatorTier: entitlements.operatorTier,
      },
      lastStripeWebhookEventId: lastStripeEventId,
      lastStripeWebhookAt: lastStripeEvent?.createdAt?.toISOString() ?? null,
      stripePriceIdsConfigured: envConfigured,
    });
  } catch (e) {
    console.error("[admin plan-debug]", e);
    return NextResponse.json({ error: "Failed to fetch plan debug" }, { status: 500 });
  }
}
