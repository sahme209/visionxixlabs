/**
 * POST /api/dashboard/release-policy-evaluate — Phase 478.
 *
 * Body: { releaseId: string, fallbackEnvironmentTier?: "dev"|...|"prod" }
 *
 * Runs the Phase 443 engine against the release's current context and
 * persists detected violations into PolicyViolation. Violations whose
 * rule now passes get marked resolved.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildPolicyEvaluateResponse,
  type PolicyEvaluateRepo,
} from "@/lib/releaseops/policyEvaluateResponder";

export const dynamic = "force-dynamic";

const ALL_TIERS = ["dev", "test", "qa", "uat", "stage", "preprod", "prod"] as const;
type TierLiteral = (typeof ALL_TIERS)[number];

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { releaseId?: unknown; fallbackEnvironmentTier?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  const tierRaw = typeof body.fallbackEnvironmentTier === "string" ? body.fallbackEnvironmentTier : null;
  const fallbackEnvironmentTier: TierLiteral | undefined =
    tierRaw && (ALL_TIERS as readonly string[]).includes(tierRaw)
      ? (tierRaw as TierLiteral)
      : undefined;

  if (!releaseId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId, fallbackEnvironmentTier? }." },
      { status: 400 },
    );
  }

  const r = await buildPolicyEvaluateResponse(
    prisma as unknown as PolicyEvaluateRepo,
    {
      organizationId: ctx.organizationId,
      releaseId,
      ...(fallbackEnvironmentTier !== undefined ? { fallbackEnvironmentTier } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
