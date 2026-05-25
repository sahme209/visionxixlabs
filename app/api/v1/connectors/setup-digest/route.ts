/**
 * GET /api/v1/connectors/setup-digest — Phase 422.
 *
 * Returns the master ConnectorSetup digest for the API key's org:
 * per-provider status + CTA + recent timeline + sticky-error class.
 * The exact shape a dashboard panel renders without further derivation.
 *
 * Required scope: pipeline:read (reusing the existing read-class scope
 * rather than minting `connector:read` — this endpoint is part of
 * "read what's happening with the platform").
 *
 * Graceful degradation: if the ConnectorSetupSession + Transition
 * tables haven't been migrated yet, returns 503 with
 *   { ok: false, error: "migration_pending", hint: ... }
 * so client UIs can show a banner instead of 500ing.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import { buildSetupDigestResponse } from "@/lib/connectors/setupDigestResponder";
import type { SnapshotRepo } from "@/lib/connectors/connectorSetupSnapshot";

export const dynamic = "force-dynamic";

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function GET(req: NextRequest) {
  const correlationId = `v1_connectors_setup_digest_${Date.now().toString(36)}`;

  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:read",
    correlationId,
    route: "GET /api/v1/connectors/setup-digest",
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

  // The Prisma client conforms structurally to SnapshotRepo — the
  // explicit cast keeps the kernel/repo modules' contract focused on
  // the subset of delegates they actually call.
  const responder = await buildSetupDigestResponse(
    prisma as unknown as SnapshotRepo,
    auth.organizationId,
    { correlationId },
  );
  return NextResponse.json(responder.body, { status: responder.status });
}
