/**
 * GET /api/admin/env-check
 *
 * Admin-only: runs validateProductionEnv against the current process
 * env and returns the typed report. Never leaks raw values — only
 * the 8-char SHA-256 prefix for presence + uniqueness signal.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isPlatformAdmin } from "@/lib/auth/platformAdmin";
import { validateProductionEnv } from "@/lib/config/envValidator";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    if (!isPlatformAdmin(ctx.email)) {
      throw AxiomErrors.validation("admin.required", "Platform admin email required.");
    }
    const report = validateProductionEnv();
    return apiOk(report, {
      correlationId,
      safetyContract: "trust_center_read_only",
      sourceMode: asApiSourceMode("live"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "trust_center_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
