/**
 * GET /api/v1/alerts/digest — Phase 432.
 *
 * Public read endpoint for the AlertEscalation master digest, scoped
 * to the API-key's organization. Reuses Phase 432 alertDigestResponder
 * so error semantics + migration_pending degradation match the
 * connector setup endpoint byte-for-byte.
 *
 * Required scope: pipeline:read — same as /api/v1/connectors/setup-digest.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import { buildAlertDigestResponse } from "@/lib/alerts/alertDigestResponder";
import type { AlertSnapshotRepo } from "@/lib/alerts/alertEscalationSnapshot";

export const dynamic = "force-dynamic";

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function GET(req: NextRequest) {
  const correlationId = `v1_alerts_digest_${Date.now().toString(36)}`;

  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:read",
    correlationId,
    route: "GET /api/v1/alerts/digest",
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

  const r = await buildAlertDigestResponse(
    prisma as unknown as AlertSnapshotRepo,
    auth.organizationId,
    { correlationId },
  );
  return NextResponse.json(r.body, { status: r.status });
}
