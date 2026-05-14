/**
 * POST /api/aws/scan
 *
 * Runs the cloud scan pipeline against an AWS connection input. Live mode
 * activates when configured; otherwise the pipeline runs the preview
 * scanner. Output is always tagged `source: "preview"` until full live
 * inventory is wired.
 *
 * Auth required.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { runCloudScanPipeline } from "@/lib/pipeline/cloudScanPipeline";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireString, requireBool } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await requireContext();
    const body = asRecord(await request.json().catch(() => ({})));
    const roleArn    = requireString(body.roleArn, "roleArn", { max: 2048 });
    const externalId = requireString(body.externalId, "externalId", { max: 1224 });
    const region     = requireString(body.region, "region", { max: 32 });
    const requestLive = body.requestLive === undefined ? true : requireBool(body.requestLive, "requestLive");

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

// Reject GET so the route doesn't accidentally serve scan data via URL.
export async function GET() {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST.")),
    { status: 405 },
  );
}
