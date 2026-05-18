/**
 * GET /api/cloud/gcp-inventory
 *
 * Returns the live GCP resource inventory snapshot. Pure read-only
 * traversal via @google-cloud/compute + @google-cloud/storage.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { extractGcpLiveInventory } from "@/lib/cloud/gcp/gcpLiveInventory";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const result = await extractGcpLiveInventory();
    return apiOk(result, {
      correlationId,
      safetyContract: "axiom_os_state_read_only",
      sourceMode: asApiSourceMode(result.mode === "live" ? "live" : "preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "axiom_os_state_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
