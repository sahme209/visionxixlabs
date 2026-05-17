/**
 * POST /api/aws/scan
 *
 * Runs the AWS scan pipeline. Live mode activates when configured
 * (AWS_SCAN_MODE=live + broker creds + valid STS AssumeRole). Live mode
 * now performs read-only EC2 / VPC / SG / S3 / RDS calls via
 * `awsLiveInventory`, optionally across multiple regions via
 * `awsMultiRegionInventory` (set `multiRegion: true` or `regions: [...]`).
 *
 * Connection credentials can come from:
 *   1. Request body (`roleArn`, `externalId`, `region`) — multi-tenant.
 *   2. Ambient env (`AWS_ROLE_ARN`, `AWS_EXTERNAL_ID`, `AWS_REGION`) when
 *      the request body omits them — single-tenant / demo deployments.
 *
 * Output is honestly tagged `source: "live" | "partial" | "preview"`.
 * Auth required.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runCloudScanPipeline } from "@/lib/pipeline/cloudScanPipeline";
import { runMultiRegionAwsInventory } from "@/lib/cloud/aws/awsMultiRegionInventory";
import { getAwsConfig, listMissingAwsConfig } from "@/lib/cloud/aws/awsConfig";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireString, requireBool, optionalString } from "@/lib/security/validation";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = `aws_scan_${Date.now().toString(36)}` as CorrelationId;
  try {
    const ctx = await requireContext();
    const body = asRecord(await request.json().catch(() => ({})));
    const cfg = getAwsConfig();

    // Connection credentials: prefer request body, fall back to ambient env.
    const roleArn = optionalString(body.roleArn, "roleArn", { max: 2048 }) ?? cfg.defaultRoleArn;
    const externalId = optionalString(body.externalId, "externalId", { max: 1224 }) ?? cfg.defaultExternalId;
    const region = optionalString(body.region, "region", { max: 32 }) ?? cfg.defaultRegion;
    const requestLive = body.requestLive === undefined ? true : requireBool(body.requestLive, "requestLive");
    const multiRegion = body.multiRegion === undefined ? false : requireBool(body.multiRegion, "multiRegion");
    const explicitRegions = Array.isArray(body.regions)
      ? body.regions.filter((r): r is string => typeof r === "string" && r.length > 0 && r.length < 32)
      : undefined;

    if (!roleArn || !externalId || !region) {
      // Honest "you'd be live if you set these" response — no crash.
      await auditRecord({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "scan.failure",
        outcome: "blocked",
        entityRef: "aws:no_connection",
        correlationId,
        detail: { reason: "missing_connection", awsMode: cfg.mode },
        errorCode: "aws.no_connection",
      });
      return NextResponse.json(
        apiSuccess({
          ok: false,
          source: "preview" as const,
          mode: "preview" as const,
          provider: "aws" as const,
          correlationId,
          missingRequirements: listMissingAwsConfig(),
          message: "Pass roleArn + externalId + region in the request body, or set AWS_ROLE_ARN + AWS_EXTERNAL_ID + AWS_REGION on the host.",
          safeNextAction: { label: "Open AWS setup", href: "/docs/aws-setup" },
        }),
        { status: 200 },
      );
    }

    // Multi-region path — only when live + explicitly requested.
    if (multiRegion && cfg.mode === "live") {
      await auditRecord({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: "scan.start",
        outcome: "success",
        entityRef: `aws:multi_region`,
        correlationId,
        detail: { provider: "aws", multiRegion: true, regions: explicitRegions?.length ?? "auto" },
      });

      const live = await runMultiRegionAwsInventory({
        organizationId: ctx.organizationId,
        roleArn,
        externalId,
        regions: explicitRegions,
        discoveryRegion: region,
        perCallTimeoutMs: 8_000,
      });

      await auditRecord({
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        action: live.source === "live" ? "scan.success" : "scan.success",
        outcome: live.source === "preview" ? "blocked" : "success",
        entityRef: `aws:multi_region`,
        correlationId,
        detail: {
          provider: "aws",
          source: live.source,
          regions: live.perRegion.length,
          resourceCount: live.snapshot.resources.length,
          findingCount: live.findings.length,
          limitations: live.limitations.length,
        },
        errorCode: live.source === "preview" ? "aws.empty_multi_region" : undefined,
      });

      return NextResponse.json(
        apiSuccess({
          ok: true,
          provider: "aws" as const,
          correlationId,
          source: live.source,
          mode: cfg.mode,
          multiRegion: true,
          accountId: live.accountId,
          preview: {
            snapshot: live.snapshot,
            findings: live.findings,
            recommendations: live.recommendations,
            durationMs: live.durationMs,
          },
          perRegion: live.perRegion,
          limitations: live.limitations,
          safeNextAction: live.findings.length > 0
            ? { label: "Review findings", href: "/dashboard/command-center" }
            : { label: "Open Command Center", href: "/dashboard/command-center" },
        }),
        { status: 200 },
      );
    }

    // Single-region path — delegates to the existing pipeline.
    const outcome = await runCloudScanPipeline({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      connection: { roleArn, externalId, region },
      requestLive,
    });

    return NextResponse.json(
      apiSuccess({
        ok: outcome.ok,
        correlationId: outcome.correlationId,
        source: outcome.source,
        mode: outcome.mode,
        provider: "aws" as const,
        validation: outcome.validation,
        preview: outcome.preview && {
          snapshot: outcome.preview.snapshot,
          findings: outcome.preview.findings,
          recommendations: outcome.preview.recommendations,
          durationMs: outcome.preview.durationMs,
        },
        safeNextAction: outcome.safeNextAction,
        traceId: outcome.trace.traceId,
      }),
      { status: outcome.ok ? 200 : 422 },
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
