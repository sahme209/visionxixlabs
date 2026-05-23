/**
 * POST /api/v1/pipelines/runs — Phase 396.
 *
 * Public, machine-to-machine pipeline-trigger endpoint. External
 * clients with an API key carrying `pipeline:trigger` scope can
 * kick off a coding run; the workspace context is derived from the
 * API key (no spoofing).
 *
 * Body:
 *   { pipelineId, instruction, repoRef, branchHint?, metadata? }
 *
 * Response (202 Accepted):
 *   { ok: true, runId, correlationId, status: "running",
 *     pollUrl: "/api/v1/pipelines/runs/<id>" }
 *
 * On validation failure → 400 with closed-union `error` code.
 * On scope/auth failure → 401/403 (handled by authenticateApiKey).
 *
 * The actual pipeline executor runs in the background via the
 * existing pipelineRunner machinery. The caller polls the GET
 * endpoint or subscribes to `pipeline.*` webhooks for completion.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { validateTriggerRunInput } from "@/lib/workforce/pipelines/validateTriggerRunInput";
import { startPipelineRun } from "@/lib/workforce/pipelines/pipelineRunner";

export const dynamic = "force-dynamic";

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function POST(req: NextRequest) {
  const correlationId = `v1_pipeline_trigger_${Date.now().toString(36)}`;

  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:trigger",
    correlationId,
    route: "POST /api/v1/pipelines/runs",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (typeof auth.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(auth.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        ok: false,
        error: auth.reason,
        ...(auth.requiredScope ? { requiredScope: auth.requiredScope } : {}),
        ...(typeof auth.retryAfterSeconds === "number" ? { retryAfterSeconds: auth.retryAfterSeconds } : {}),
      },
      { status: auth.httpStatus, headers },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const validation = validateTriggerRunInput(body);
  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: validation.error,
        message: validation.message,
        ...(validation.field ? { field: validation.field } : {}),
      },
      { status: 400 },
    );
  }

  const result = await startPipelineRun({
    organizationId: auth.organizationId,
    pipelineId: validation.pipelineId,
    triggeredBy: `api_key:${auth.apiKeyId}`,
    metadata: {
      instruction: validation.instruction,
      repoRef: validation.repoRef,
      branchHint: validation.branchHint,
      // Round-trip operator-supplied metadata so webhook listeners
      // can correlate the run back to its originating context.
      ...validation.metadata,
      _triggeredVia: "api_v1",
      _apiKeyEnv: auth.env,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.reason },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      runId: result.runId,
      correlationId: result.correlationId,
      status: "running",
      pollUrl: `/api/v1/pipelines/runs/${result.runId}`,
    },
    { status: 202 },
  );
}
