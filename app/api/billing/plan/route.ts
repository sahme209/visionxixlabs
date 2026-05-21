/**
 * GET /api/billing/plan
 *
 * Returns the caller's tenant billing plan (with the resolved tier
 * spec + trial days remaining). Auto-creates a trial row on first
 * call so first-run UX is never blocked by missing billing setup.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { describeStripeStatus } from "@/lib/billing/stripeHelper";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    // Tenants without a paid plan get status: "no_plan". We do NOT auto-grant
    // a trial — there is no trial product. The billing page renders a calm
    // "pick a plan" empty state when status === "no_plan".
    const plan = await readBillingPlan(String(ctx.organizationId));
    return apiOk({ plan, stripe: describeStripeStatus() }, {
      correlationId,
      safetyContract: "billing_summary_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "billing_summary_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
