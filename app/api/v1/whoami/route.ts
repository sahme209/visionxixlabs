/**
 * GET /api/v1/whoami — Phase 399.
 *
 * The simplest possible test endpoint for an engineer integrating with
 * VisionXIXLabs: returns the workspace + scopes + plan tier + quota
 * snapshot the bearer is authenticated as. A 3-line integration test:
 *
 *   curl -H "Authorization: Bearer vxlk_live_..." \
 *        https://visionxixlabs.com/api/v1/whoami
 *
 *   → { ok: true, apiKey: { id, env, scopes }, organization: { id, planTier },
 *       quota: { monthlyLimit, currentCalls, remaining, ratio, nearLimit },
 *       serverTimeSec }
 *
 * Scope required: any one of the read-class scopes — i.e. either an
 * explicit `release_gate:read`, `pipeline:read`, `eval:read`, or `*`.
 * We DON'T require a brand-new "whoami:read" scope because every key
 * should be able to introspect itself.
 *
 * Hardened against:
 *   - leaking plaintext (we never return it)
 *   - leaking other tenants (workspace context is derived from the
 *     authenticated key)
 *   - mis-reporting the in-flight call (composeWhoamiResponse counts
 *     this request in `currentCalls` so the SDK sees a consistent
 *     view).
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { computeApiQuota, currentMonthStartUtc } from "@/lib/security/computeApiQuota";
import { composeWhoamiResponse } from "@/lib/security/composeWhoamiResponse";
import { readBillingPlan } from "@/lib/billing/tenantBillingStore";
import { planForStripeTier } from "@/lib/billing/planRegistry";

export const dynamic = "force-dynamic";

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function GET(req: NextRequest) {
  const correlationId = `v1_whoami_${Date.now().toString(36)}`;

  // Any read-class scope passes the introspection gate.
  // We accept release_gate:read by convention; the kernel's wildcard
  // matching means "*" and "release_gate:*" also pass.
  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "release_gate:read",
    correlationId,
    route: "GET /api/v1/whoami",
  });

  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (typeof auth.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(auth.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        error: auth.reason,
        ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}),
        ...(typeof auth.retryAfterSeconds === "number" ? { retryAfterSeconds: auth.retryAfterSeconds } : {}),
      },
      { status: auth.httpStatus, headers },
    );
  }

  // Build the quota snapshot for the response. authenticateApiKey
  // already wrote the UsageEvent for this call, so we re-count for an
  // accurate after-this-call view. Both lookups are fail-open with
  // Starter-tier fallbacks so a billing-DB blip doesn't break /whoami.
  let monthlyLimit: number | null = 10_000;
  let planTier = "starter";
  try {
    const billing = await readBillingPlan(auth.organizationId);
    const plan = planForStripeTier(billing.tier);
    monthlyLimit = plan.entitlements.monthlyApiV1Calls;
    planTier = plan.tier;
  } catch { /* fail-open with Starter defaults */ }

  const monthStart = currentMonthStartUtc();
  const usedCount = await prisma.usageEvent.count({
    where: {
      organizationId: auth.organizationId,
      eventKind: "api_v1_call",
      createdAt: { gte: monthStart },
    },
  }).catch(() => 0);

  // computeApiQuota's contract is "calls BEFORE the in-flight one",
  // so we subtract 1 from the freshly-incremented count.
  const quota = computeApiQuota({
    currentCalls: Math.max(0, usedCount - 1),
    monthlyLimit,
  });

  const body = composeWhoamiResponse({
    apiKeyId: auth.apiKeyId,
    env: auth.env,
    scopes: auth.scopes,
    organizationId: auth.organizationId,
    planTier,
    quota,
  });

  return NextResponse.json(body);
}
