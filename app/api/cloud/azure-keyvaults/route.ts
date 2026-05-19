/**
 * GET /api/cloud/azure-keyvaults
 *
 * Returns the AzureKeyVaultExtraction — every Key Vault in the
 * subscription with soft-delete + purge protection + RBAC +
 * public-access posture.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { extractAzureKeyVaults } from "@/lib/cloud/azure/azureKeyVaultExtractor";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const result = await extractAzureKeyVaults();
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
