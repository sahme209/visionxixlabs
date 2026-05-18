/**
 * GET /api/desktop/intelligence
 *
 * Returns the canonical DesktopIntelligenceReport via the canonical
 * API envelope. Tenant-scoped. Never executes locally — the boundary
 * is enforced at the type level by the
 * `desktop_review_only_no_local_execution` safety contract.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildDesktopIntelligence } from "@/lib/desktop/desktopIntelligenceBuilder";
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
    const report = await buildDesktopIntelligence({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "desktop_review_only_no_local_execution",
      sourceMode: asApiSourceMode(report.pairing.binaryAvailable ? "partial_live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, {
      correlationId,
      safetyContract: "desktop_review_only_no_local_execution",
    });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
