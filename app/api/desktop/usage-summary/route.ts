/**
 * GET /api/desktop/usage-summary
 *
 * Live month-to-date AI usage for the desktop Plan & Usage section —
 * invocation count, token totals, and cost. Any paired session may
 * read its own workspace's usage; no admin gate needed since this is
 * read-only self-reporting, same posture as /api/desktop/billing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { buildUsageSummaryResponse, type UsageSummaryRepo } from "@/lib/billing/usageSummaryResponder";
import { readBillingPlanWithAvailability } from "@/lib/billing/tenantBillingStore";
import { readCurrentAIAllowance } from "@/lib/billing/currentAIAllowance";
import type { DesktopBillingSnapshot } from "@/lib/desktop/desktopBillingSummary";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "GET /api/desktop/usage-summary",
    allowApiKey: false,
  });
  if (!session) {
    return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  }
  const organizationId = String(session.organizationId);
  const [usage, billing, allowance] = await Promise.all([
    buildUsageSummaryResponse(prisma as unknown as UsageSummaryRepo, organizationId),
    readBillingPlanWithAvailability(organizationId).catch(() => null),
    readCurrentAIAllowance(prisma, organizationId).catch(() => ({ available: false } as const)),
  ]);
  const headers = { "cache-control": "no-store" };
  if (!usage.body.ok) return NextResponse.json(usage.body, { status: usage.status, headers });
  const plan = billing?.plan;
  const billingSnapshot: DesktopBillingSnapshot = {
    version: 1,
    canManageBilling: session.role === "owner" || session.role === "admin",
    plan: billing?.available && plan && plan.pricingPlanAvailable !== false ? {
      available: true,
      label: plan.pricingPlan?.displayName ?? plan.spec.label,
      status: plan.status,
      hasCustomer: Boolean(plan.stripeCustomerId),
      ...(plan.publicPlanId ? { publicPlanId: plan.publicPlanId } : {}),
    } : { available: false },
    allowance,
  };
  return NextResponse.json({ ok: true, data: { ...usage.body.data, billingSnapshot } }, {
    status: usage.status, headers,
  });
}
