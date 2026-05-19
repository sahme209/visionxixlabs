/**
 * GET /api/help/entries
 *
 * Returns the full help knowledge-base — every typed entry grouped
 * by category. Powers /dashboard/help and the in-app help bubble.
 */

import type { NextRequest } from "next/server";
import { HELP_ENTRIES, helpEntriesByCategory, CATEGORY_LABEL } from "@/lib/help/helpKnowledgeBase";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    return apiOk({
      total: HELP_ENTRIES.length,
      entries: HELP_ENTRIES,
      byCategory: helpEntriesByCategory(),
      categoryLabels: CATEGORY_LABEL,
    }, {
      correlationId,
      safetyContract: "trust_center_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "trust_center_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
