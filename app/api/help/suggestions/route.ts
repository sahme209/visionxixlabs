/**
 * GET /api/help/suggestions
 *
 * Returns the NoMatchSuggestReport — clustered no_match queries
 * with suggested category + keywords. Operators copy each into
 * lib/help/helpKnowledgeBase.ts to close the docs gap.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildNoMatchSuggestions } from "@/lib/help/noMatchSuggester";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const raw = req.nextUrl.searchParams.get("limit");
    const limit = raw ? Number.parseInt(raw, 10) : undefined;
    const report = await buildNoMatchSuggestions({
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "trust_center_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "trust_center_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
