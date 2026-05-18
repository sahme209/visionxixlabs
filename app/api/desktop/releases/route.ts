/**
 * GET /api/desktop/releases
 *
 * Returns the canonical DesktopReleaseReport via the canonical API
 * envelope. Tenant-scoped. Never publishes — the contract is
 * `release_review_only_no_publish`.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildDesktopReleaseReport } from "@/lib/desktop/desktopReleaseBuilder";
import {
  apiOk,
  apiErr,
  asApiSourceMode,
  resolveCorrelationId,
} from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildDesktopReleaseReport({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "release_review_only_no_publish",
      sourceMode: asApiSourceMode(report.sourceMode),
    });
  } catch (err) {
    return apiErr(err, {
      correlationId,
      safetyContract: "release_review_only_no_publish",
    });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
