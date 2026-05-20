/**
 * GET /api/flags/public
 *
 * Returns just the UI-relevant flag booleans for the caller's tenant.
 * No rationale, no audit fields — designed to be safe for client
 * components to fetch and use directly. The full flag editor lives at
 * /dashboard/flags (admin-only context).
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isFlagEnabled } from "@/lib/flags/featureFlagStore";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import type { FeatureFlagKey } from "@/lib/flags/featureFlagCatalog";

export const dynamic = "force-dynamic";

const PUBLIC_FLAGS: FeatureFlagKey[] = ["ui.contextual_help_bubble"];

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    const orgId = ctx.organizationId ? String(ctx.organizationId) : "anonymous";
    const flags: Record<string, boolean> = {};
    for (const key of PUBLIC_FLAGS) {
      flags[key] = await isFlagEnabled({ organizationId: orgId, key });
    }
    return apiOk({ flags }, {
      correlationId,
      safetyContract: "trust_center_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "trust_center_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
