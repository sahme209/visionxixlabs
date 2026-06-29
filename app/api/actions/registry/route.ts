/** GET /api/actions/registry — Phase 650.
 *
 * Returns the canonical action catalog + honesty counts. Used by
 * Command Center, Capabilities surface, Copilot, and any future
 * dashboard wanting to introspect "what can Axiom do right now?".
 *
 * No auth gate — the registry is metadata, not workspace data.
 * Operators can call it from the public help center.
 */

import { NextResponse } from "next/server";
import {
  ACTION_REGISTRY,
  CATEGORY_LABEL,
  STATUS_LABEL,
  SAFETY_LABEL,
  computeHonestyCounts,
  getActionsByCategory,
  getActionsByStatus,
} from "@/lib/actions/actionRegistry";

export const dynamic = "force-static";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    registry: ACTION_REGISTRY,
    counts: computeHonestyCounts(),
    byCategory: getActionsByCategory(),
    byStatus: getActionsByStatus(),
    labels: {
      category: CATEGORY_LABEL,
      status: STATUS_LABEL,
      safety: SAFETY_LABEL,
    },
  });
}
