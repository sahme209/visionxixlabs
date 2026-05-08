/**
 * GET /api/axiom/entitlements
 *
 * Returns the user's Axiom feature access — what's unlocked, what's locked,
 * upgrade copy, and preview limits. Used by the frontend to render gating UI.
 *
 * GET /api/axiom/entitlements?feature=terraform_export
 *   → Check a single feature
 *
 * GET /api/axiom/entitlements
 *   → Full entitlements summary
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlementsFromPlan } from "@/lib/entitlements";
import {
  checkFeatureAccess,
  buildUpgradeSummary,
  FREE_LIMITS,
  FREE_PREVIEW_COPY,
  FEATURE_INFO,
  type AxiomFeature,
} from "@/lib/axiom/proGating";

const VALID_FEATURES = new Set(FEATURE_INFO.map((f) => f.key));

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(session.user as { id?: string }).id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const entitlements = getEntitlementsFromPlan(user?.plan ?? null);

  const featureParam = req.nextUrl.searchParams.get("feature");

  if (featureParam) {
    if (!VALID_FEATURES.has(featureParam as AxiomFeature)) {
      return NextResponse.json(
        { error: `Unknown feature: ${featureParam}`, validFeatures: [...VALID_FEATURES] },
        { status: 400 },
      );
    }

    const result = checkFeatureAccess(entitlements, featureParam as AxiomFeature);
    return NextResponse.json({ feature: featureParam, ...result });
  }

  const summary = buildUpgradeSummary(entitlements);

  return NextResponse.json({
    ...summary,
    freeLimits: FREE_LIMITS,
    previewCopy: FREE_PREVIEW_COPY,
  });
}
