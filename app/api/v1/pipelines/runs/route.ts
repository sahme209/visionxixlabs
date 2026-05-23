/**
 * POST /api/v1/pipelines/runs — Phase 396 + 402.
 *
 * Public, machine-to-machine pipeline-trigger endpoint. External
 * clients with an API key carrying `pipeline:trigger` scope can
 * kick off a coding run; the workspace context is derived from the
 * API key (no spoofing).
 *
 * Body:
 *   { pipelineId, instruction, repoRef, branchHint?, metadata? }
 *
 * Optional headers:
 *   Idempotency-Key: <client-uuid>     — Phase 402, Stripe-style. When
 *     present, a duplicate POST with the same key + body returns the
 *     cached response instead of firing a second pipeline run. A
 *     duplicate POST with the same key but a DIFFERENT body returns
 *     422. A duplicate POST while the first call is still processing
 *     returns 409.
 *
 * Response (202 Accepted):
 *   { ok: true, runId, correlationId, status: "running",
 *     pollUrl: "/api/v1/pipelines/runs/<id>",
 *     idempotent?: true }
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
import {
  parseIdempotencyKeyHeader,
  hashRequestBody,
} from "@/lib/security/idempotency";
import {
  claimIdempotencySlot,
  completeIdempotencySlot,
} from "@/lib/security/idempotencyStore";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROUTE_PATH = "POST /api/v1/pipelines/runs";

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
    route: ROUTE_PATH,
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

  // Read the raw body ONCE so we can hash it for idempotency and parse
  // it for the validator without consuming the stream twice.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body_read" }, { status: 400 });
  }

  // ---------- Idempotency gate ----------
  const idemHeader = req.headers.get("idempotency-key") ?? req.headers.get("Idempotency-Key");
  const keyParse = parseIdempotencyKeyHeader(idemHeader);
  let idempotencyRecordId: string | null = null;

  if (keyParse.ok) {
    const claim = await claimIdempotencySlot({
      organizationId: auth.organizationId,
      idempotencyKey: keyParse.key,
      routePath: ROUTE_PATH,
      requestBodyHash: hashRequestBody(rawBody),
    });

    if (claim.decision.kind === "replay_completed" && claim.decision.cachedResponse) {
      const cached = claim.decision.cachedResponse;
      return NextResponse.json(
        cached.body as Record<string, unknown>,
        {
          status: cached.httpStatus,
          headers: { "X-VXL-Idempotent-Replay": "true" },
        },
      );
    }
    if (claim.decision.kind === "in_flight" || claim.decision.kind === "body_mismatch") {
      return NextResponse.json(
        {
          ok: false,
          error: claim.decision.kind,
          message: claim.decision.message,
        },
        { status: claim.decision.httpStatus ?? 409 },
      );
    }
    // "no_record" or "expired" (overwritten) — proceed with fresh processing.
    idempotencyRecordId = claim.recordId;
  } else if (idemHeader !== null) {
    // Header was supplied but malformed — refuse rather than silently
    // ignore, since the client believed they had idempotency protection.
    return NextResponse.json(
      {
        ok: false,
        error: "idempotency_key_invalid",
        message: `Idempotency-Key header invalid: ${keyParse.reason}.`,
      },
      { status: 400 },
    );
  }

  // ---------- Validation ----------
  let parsedJson: unknown;
  try { parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null; }
  catch {
    const resp = { ok: false as const, error: "invalid_json" };
    if (idempotencyRecordId) {
      await completeIdempotencySlot({
        recordId: idempotencyRecordId,
        status: "failed",
        responseStatus: 400,
        responseBody: resp,
        organizationId: auth.organizationId,
        correlationId,
      });
    }
    return NextResponse.json(resp, { status: 400 });
  }

  const validation = validateTriggerRunInput(parsedJson);
  if (!validation.ok) {
    const resp = {
      ok: false as const,
      error: validation.error,
      message: validation.message,
      ...(validation.field ? { field: validation.field } : {}),
    };
    if (idempotencyRecordId) {
      await completeIdempotencySlot({
        recordId: idempotencyRecordId,
        status: "failed",
        responseStatus: 400,
        responseBody: resp,
        organizationId: auth.organizationId,
        correlationId,
      });
    }
    return NextResponse.json(resp, { status: 400 });
  }

  const result = await startPipelineRun({
    organizationId: auth.organizationId,
    pipelineId: validation.pipelineId,
    triggeredBy: `api_key:${auth.apiKeyId}`,
    metadata: {
      instruction: validation.instruction,
      repoRef: validation.repoRef,
      branchHint: validation.branchHint,
      ...validation.metadata,
      _triggeredVia: "api_v1",
      _apiKeyEnv: auth.env,
    },
  });

  if (!result.ok) {
    const resp = { ok: false as const, error: result.reason };
    if (idempotencyRecordId) {
      await completeIdempotencySlot({
        recordId: idempotencyRecordId,
        status: "failed",
        responseStatus: 404,
        responseBody: resp,
        organizationId: auth.organizationId,
        correlationId,
      });
    }
    return NextResponse.json(resp, { status: 404 });
  }

  const okBody = {
    ok: true as const,
    runId: result.runId,
    correlationId: result.correlationId,
    status: "running" as const,
    pollUrl: `/api/v1/pipelines/runs/${result.runId}`,
  };
  if (idempotencyRecordId) {
    await completeIdempotencySlot({
      recordId: idempotencyRecordId,
      status: "completed",
      responseStatus: 202,
      responseBody: okBody,
      organizationId: auth.organizationId,
      correlationId,
    });
  }

  return NextResponse.json(okBody, { status: 202 });
}

/**
 * GET /api/v1/pipelines/runs — list recent pipeline runs for the
 * workspace identified by the API key. Required scope: pipeline:read.
 *
 * Query params:
 *   ?limit=<1..100>  — page size; default 25
 *   ?cursor=<runId>  — paginate by run id (descending creation order)
 *   ?status=<one>    — filter by status: running | succeeded | failed | awaiting_approval
 *
 * Response:
 *   {
 *     ok: true,
 *     runs: [
 *       { id, pipelineId, status, triggeredBy, correlationId,
 *         startedAt, completedAt, errorSummary, stageCount }
 *     ],
 *     nextCursor: string | null
 *   }
 *
 * Cross-tenant safety: every row is filtered by auth.organizationId
 * (workspace context derived from the API key — no spoofing).
 */
export async function GET(req: NextRequest) {
  const correlationId = `v1_pipeline_list_${Date.now().toString(36)}`;

  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:read",
    correlationId,
    route: "GET /api/v1/pipelines/runs",
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

  const url = req.nextUrl;
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(100, Math.floor(rawLimit)))
    : 25;
  const cursor = url.searchParams.get("cursor");
  const statusFilter = url.searchParams.get("status");

  const where: {
    organizationId: string;
    status?: string;
  } = { organizationId: auth.organizationId };
  if (
    statusFilter === "running" ||
    statusFilter === "succeeded" ||
    statusFilter === "failed" ||
    statusFilter === "awaiting_approval"
  ) {
    where.status = statusFilter;
  }

  // Fetch limit+1 so we know whether there's a next page.
  const rows = await prisma.pipelineRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      pipelineId: true,
      status: true,
      triggeredBy: true,
      correlationId: true,
      startedAt: true,
      completedAt: true,
      errorSummary: true,
      _count: { select: { stages: true } },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({
    ok: true,
    runs: page.map((r) => ({
      id: r.id,
      pipelineId: r.pipelineId,
      status: r.status,
      triggeredBy: r.triggeredBy,
      correlationId: r.correlationId,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      errorSummary: r.errorSummary,
      stageCount: r._count.stages,
    })),
    nextCursor,
  });
}
