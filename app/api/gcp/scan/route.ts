/**
 * POST /api/gcp/scan
 *
 * Runs the GCP scanner against a connection input. Live mode runs a
 * `@google-cloud/resource-manager` project read when configured
 * (GCP_SCAN_MODE=live + credentials). Otherwise returns the preview
 * snapshot. Always audited.
 *
 * Read-only. Never mutates GCP.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { validateGcpConnection } from "@/lib/cloud/gcp/gcpValidator";
import { runPreviewGcpScan } from "@/lib/cloud/gcp/gcpPreviewScanner";
import { getGcpConfig } from "@/lib/cloud/gcp/gcpConfig";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireString, requireBool, optionalString } from "@/lib/security/validation";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = `gcp_scan_${Date.now().toString(36)}` as CorrelationId;
  try {
    const ctx = await requireContext();
    const body = asRecord(await request.json().catch(() => ({})));
    const projectId            = requireString(body.projectId, "projectId", { max: 64 });
    const serviceAccountEmail  = optionalString(body.serviceAccountEmail,  "serviceAccountEmail",  { max: 256 });
    const serviceAccountKeyJson = optionalString(body.serviceAccountKeyJson, "serviceAccountKeyJson", { max: 8192 });
    const region               = optionalString(body.region,               "region",               { max: 64 });
    const requestLive          = body.requestLive === undefined ? true : requireBool(body.requestLive, "requestLive");

    const cfg = getGcpConfig();

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "scan.start",
      outcome: "success",
      entityRef: `gcp:${projectId}`,
      correlationId,
      detail: { provider: "gcp", mode: cfg.mode, requestLive },
    });

    const validation = await validateGcpConnection({
      input: { projectId, serviceAccountEmail, serviceAccountKeyJson, region },
      requestLive,
    });

    const preview = await runPreviewGcpScan({
      organizationId: ctx.organizationId,
      region,
    });

    const liveCallSucceeded = validation.outcome === "valid_live";
    const source: "live" | "preview" | "partial" = liveCallSucceeded ? "partial" : "preview";

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: validation.ok ? "scan.success" : "scan.failure",
      outcome: validation.ok ? "success" : "failure",
      entityRef: `gcp:${projectId}`,
      correlationId,
      detail: {
        provider: "gcp",
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
        provider: "gcp" as const,
        ok: validation.ok,
        correlationId,
        source,
        mode: validation.mode,
        validation: {
          outcome: validation.outcome,
          message: validation.message,
          validatedProjectId: validation.validatedProjectId,
          projectDisplayName: validation.projectDisplayName,
          serviceAccountEmail: validation.serviceAccountEmail,
          errorCode: validation.errorCode,
          missingRequirements: validation.missingRequirements,
          limitations: validation.limitations,
        },
        preview,
        safeNextAction:
          validation.safeNextAction ??
          (validation.ok ? { label: "Review findings", href: "/dashboard/multi-cloud" } : { label: "Open GCP setup", href: "/docs/gcp-setup" }),
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
