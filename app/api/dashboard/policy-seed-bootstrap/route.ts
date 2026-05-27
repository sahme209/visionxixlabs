/**
 * POST /api/dashboard/policy-seed-bootstrap — Phase 484.
 *
 * Copies the seed catalog into the caller's PolicyRule table.
 * Idempotent — operator-edited rules are preserved.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildPolicySeedBootstrapResponse,
  type PolicySeedBootstrapRepo,
} from "@/lib/releaseops/policySeedBootstrapResponder";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  const r = await buildPolicySeedBootstrapResponse(
    prisma as unknown as PolicySeedBootstrapRepo,
    { organizationId: ctx.organizationId },
  );
  return NextResponse.json(r.body, { status: r.status });
}
