/**
 * GET /api/dashboard/sops/[deploymentType] — Phase 448.
 *
 * Returns the full SOP document for a single deployment type. Pure
 * server-rendered from the Phase 446 generator; no DB read for now.
 * Future per-org SOP overrides hook in here.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import {
  ALL_DEPLOYMENT_TYPES,
  generateSop,
  type DeploymentType,
} from "@/lib/releaseops/sopGenerator";

export const dynamic = "force-dynamic";

function isDeploymentType(s: string): s is DeploymentType {
  return (ALL_DEPLOYMENT_TYPES as readonly string[]).includes(s);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deploymentType: string }> },
) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const { deploymentType } = await params;
  if (!isDeploymentType(deploymentType)) {
    return NextResponse.json({ ok: false, error: "unknown_deployment_type" }, { status: 400 });
  }
  const doc = generateSop(deploymentType);
  return NextResponse.json({ ok: true, data: doc });
}
