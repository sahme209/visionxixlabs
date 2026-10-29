/**
 * GET /api/cloud/gcp-inventory
 *
 * Tenant inventory remains blocked until a tenant-owned GCP connection exists.
 * Deployment credentials never authorize workspace inventory access.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import type { GcpLiveInventoryResult } from "@/lib/cloud/gcp/gcpLiveInventory";
import { apiOk, apiErr, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const result: GcpLiveInventoryResult = {
      mode: "blocked",
      counts: { instanceCount: 0, bucketCount: 0, firewallRuleCount: 0 },
      publicBucketCount: 0,
      allOpenFirewallCount: 0,
      durationMs: 0,
      limitations: ["gcp.tenant_connection_required: GCP inventory needs a verified workspace connection bound to the selected project. No inventory was read."],
    };
    return apiOk(result, {
      correlationId,
      safetyContract: "axiom_os_state_read_only",
      sourceMode: "preview",
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "axiom_os_state_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
