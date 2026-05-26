/**
 * GET /api/dashboard/sops — Phase 448.
 *
 * Returns the catalog of 10 deployment-type SOPs. Stateless today
 * (no per-org overrides yet) but routed through the dashboard auth
 * boundary so future per-org override storage can hook in without
 * a route change.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import {
  ALL_DEPLOYMENT_TYPES,
  deploymentTypeLabel,
} from "@/lib/releaseops/sopGenerator";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    data: {
      catalog: ALL_DEPLOYMENT_TYPES.map((t) => ({
        deploymentType: t,
        label: deploymentTypeLabel(t),
      })),
    },
  });
}
