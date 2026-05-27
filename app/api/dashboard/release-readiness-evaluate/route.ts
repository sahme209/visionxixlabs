/**
 * POST /api/dashboard/release-readiness-evaluate — Phase 480.
 *
 * Body: {
 *   releaseId: string,
 *   branchValidation?: { total, passing, failing, notApplicable, unknown },
 *   hasManualProdFixes?: boolean
 * }
 *
 * Computes a fresh readiness snapshot from current data and appends
 * it to ReleaseReadinessSnapshot. Each call appends a new row — the
 * table is the audit trail.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  buildReleaseReadinessResponse,
  type ReleaseReadinessRepo,
} from "@/lib/releaseops/releaseReadinessResponder";

export const dynamic = "force-dynamic";

interface BranchValidationLike {
  total: number; passing: number; failing: number; notApplicable: number; unknown: number;
}
function isBranchValidationLike(v: unknown): v is BranchValidationLike {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return ["total", "passing", "failing", "notApplicable", "unknown"].every((k) => typeof o[k] === "number");
}

export async function POST(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  let body: { releaseId?: unknown; branchValidation?: unknown; hasManualProdFixes?: unknown } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  const releaseId = typeof body.releaseId === "string" ? body.releaseId : null;
  if (!releaseId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", hint: "Body must contain { releaseId, branchValidation?, hasManualProdFixes? }." },
      { status: 400 },
    );
  }

  const branchValidation = isBranchValidationLike(body.branchValidation) ? body.branchValidation : undefined;
  const hasManualProdFixes = typeof body.hasManualProdFixes === "boolean" ? body.hasManualProdFixes : undefined;

  const r = await buildReleaseReadinessResponse(
    prisma as unknown as ReleaseReadinessRepo,
    {
      organizationId: ctx.organizationId,
      releaseId,
      ...(branchValidation !== undefined ? { branchValidation } : {}),
      ...(hasManualProdFixes !== undefined ? { hasManualProdFixes } : {}),
    },
  );
  return NextResponse.json(r.body, { status: r.status });
}
