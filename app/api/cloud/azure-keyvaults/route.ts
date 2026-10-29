/**
 * GET /api/cloud/azure-keyvaults
 *
 * Returns the AzureKeyVaultExtraction — every Key Vault in the
 * subscription with soft-delete + purge protection + RBAC +
 * public-access posture.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    // Deployment-host credentials are not a tenant-owned connection.
    // Keep internal extractors separate from this authenticated tenant view.
    const result = { mode: "blocked" as const, total: 0, noSoftDeleteCount: 0, noPurgeProtectionCount: 0, publicAccessCount: 0, vaults: [], durationMs: 0, limitations: ["tenant_connection_required: Tenant-scoped Azure Key Vault inventory is not wired to this view. Use the verified desktop Azure connection."] };
    return apiOk(result, {
      correlationId,
      safetyContract: "axiom_os_state_read_only",
      sourceMode: asApiSourceMode("preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "axiom_os_state_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
