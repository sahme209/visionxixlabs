/**
 * POST /api/azure/scan
 *
 * Runs the Azure scanner against a connection input. Live mode runs an
 * `@azure/identity` validation + ARM Resource Graph query when configured
 * (AZURE_SCAN_MODE=live + AZURE_* env vars). Otherwise it returns the
 * preview snapshot. Always audited.
 *
 * Read-only. Never mutates Azure.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { validateAzureConnection } from "@/lib/cloud/azure/azureValidator";
import { runPreviewAzureScan } from "@/lib/cloud/azure/azurePreviewScanner";
import { getAzureConfig } from "@/lib/cloud/azure/azureConfig";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireString, requireBool, optionalString } from "@/lib/security/validation";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = `azure_scan_${Date.now().toString(36)}` as CorrelationId;
  try {
    const ctx = await requireContext();
    const body = asRecord(await request.json().catch(() => ({})));
    const tenantId       = requireString(body.tenantId,       "tenantId",       { max: 64 });
    const subscriptionId = requireString(body.subscriptionId, "subscriptionId", { max: 64 });
    const clientId       = optionalString(body.clientId,       "clientId",       { max: 128 });
    const clientSecret   = optionalString(body.clientSecret,   "clientSecret",   { max: 4096 });
    const location       = optionalString(body.location,       "location",       { max: 64 });
    const requestLive    = body.requestLive === undefined ? true : requireBool(body.requestLive, "requestLive");

    const cfg = getAzureConfig();

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "scan.start",
      outcome: "success",
      entityRef: `azure:${subscriptionId}`,
      correlationId,
      detail: { provider: "azure", mode: cfg.mode, requestLive },
    });

    // 1) Validation pass
    const validation = await validateAzureConnection({
      input: { tenantId, subscriptionId, clientId, clientSecret, location },
      requestLive,
    });

    // 2) Snapshot — live snapshot live wiring deferred (preview shape stays canonical)
    const preview = await runPreviewAzureScan({
      organizationId: ctx.organizationId,
      location: validation.subscriptionDisplayName ? location : location,
    });

    const liveCallSucceeded = validation.outcome === "valid_live";
    const source: "live" | "preview" | "partial" = liveCallSucceeded ? "partial" : "preview";

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: validation.ok ? "scan.success" : "scan.failure",
      outcome: validation.ok ? "success" : "failure",
      entityRef: `azure:${subscriptionId}`,
      correlationId,
      detail: {
        provider: "azure",
        mode: validation.mode,
        outcome: validation.outcome,
        source,
        resourceCount: preview.snapshot.resources.length,
        findingCount: preview.findings.length,
      },
      errorCode: validation.errorCode,
    });

    return NextResponse.json(
      apiSuccess({
        provider: "azure" as const,
        ok: validation.ok,
        correlationId,
        source,
        mode: validation.mode,
        validation: {
          outcome: validation.outcome,
          message: validation.message,
          validatedTenantId: validation.validatedTenantId,
          validatedSubscriptionId: validation.validatedSubscriptionId,
          subscriptionDisplayName: validation.subscriptionDisplayName,
          errorCode: validation.errorCode,
          missingRequirements: validation.missingRequirements,
          limitations: validation.limitations,
        },
        preview,
        safeNextAction:
          validation.safeNextAction ??
          (validation.ok ? { label: "Review findings", href: "/dashboard/multi-cloud" } : { label: "Open Azure setup", href: "/docs/azure-setup" }),
      }),
      { status: validation.ok ? 200 : 422 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET() {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST.")),
    { status: 405 },
  );
}
