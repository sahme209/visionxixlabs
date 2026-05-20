/**
 * GET /api/help/analytics
 *
 * Returns the HelpQueryAnalytics summary — per-verdict counts, top
 * queries, top no_match queries (the real signal for missing docs),
 * and the recent query list.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { readHelpQueryAnalytics } from "@/lib/help/helpQueryStore";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const analytics = await readHelpQueryAnalytics({
      organizationId: ctx.organizationId ? String(ctx.organizationId) : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return apiOk(analytics, {
      correlationId,
      safetyContract: "trust_center_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "trust_center_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
