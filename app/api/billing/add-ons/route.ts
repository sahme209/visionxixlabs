/**
 * GET /api/billing/add-ons — Phase 386.
 *
 * Returns the add-on catalog filtered to what the workspace's plan
 * can buy, plus the workspace's purchase history this period and
 * the currently-applied add-on totals.
 *
 * Auth: workspace member.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { planForStripeTier } from "@/lib/billing/planRegistry";
import { findAddOnsForPlan } from "@/lib/billing/addOnCatalog";
import { effectiveEntitlements } from "@/lib/billing/effectiveEntitlements";

export const dynamic = "force-dynamic";

const periodKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export async function GET() {
  const session = await currentContext();
  if (!session.isAuthenticated || !session.organizationId) {
    return NextResponse.json({ ok: false, reason: "auth_required" }, { status: 401 });
  }
  const orgId = String(session.organizationId);
  const period = periodKey(new Date());

  const billing = await readBillingPlan(orgId).catch(() => null);
  const plan = planForStripeTier(billing?.tier);
  const catalog = findAddOnsForPlan(plan);

  const purchases = await prisma.addOnPurchase.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  }).catch(() => [] as Array<never>);

  const eff = await effectiveEntitlements(orgId, plan);

  return NextResponse.json({
    ok: true,
    plan: { tier: plan.tier, displayName: plan.displayName },
    periodMonth: period,
    catalog: catalog.map((a) => ({
      sku: a.sku,
      displayName: a.displayName,
      category: a.category,
      tagline: a.tagline,
      priceCents: a.priceCents,
      deliveredAICreditsCents: a.deliveredAICreditsCents,
      deliveredSeats: a.deliveredSeats,
      deliveredConnectors: a.deliveredConnectors,
      validFor: a.validFor,
    })),
    applied: {
      aiCreditsCents: eff.appliedAICreditsCents,
      seats: eff.appliedSeats,
      connectors: eff.appliedConnectors,
      effectivePoolCents: eff.includedAICreditsCents,
    },
    history: purchases.map((p) => ({
      id: p.id,
      sku: p.sku,
      pricePaidCents: p.pricePaidCents,
      status: p.status,
      periodMonth: p.periodMonth,
      validFor: p.validFor,
      purchasedBy: p.purchasedBy,
      createdAt: p.createdAt.toISOString(),
      appliedAt: p.appliedAt?.toISOString() ?? null,
      refundedAt: p.refundedAt?.toISOString() ?? null,
    })),
  });
}
