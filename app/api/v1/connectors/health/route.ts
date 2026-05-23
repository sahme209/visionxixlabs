/**
 * GET /api/v1/connectors/health — Phase 407.
 *
 * Public read endpoint for per-connector health telemetry. Scoped to
 * the API key's organization.
 *
 * Required scope: pipeline:read (re-using the read-class scope rather
 * than minting a new one — health is part of "read what's happening").
 *
 * Response (200):
 *   {
 *     ok: true,
 *     generatedAt: ISO,
 *     summary: {
 *       healthy:      number,
 *       degraded:     number,
 *       stale:        number,
 *       auth_failed:  number,
 *       rate_limited: number,
 *     },
 *     connectors: [
 *       {
 *         name, category, status, stage, reason,
 *         successRatio: number | null,
 *         ageMs: number | null,
 *         recentSuccessCount, recentErrorCount,
 *       }
 *     ]
 *   }
 *
 * Mock telemetry today: the platform's per-connector telemetry table is
 * still being wired (real lib/cloud/connectorLifecycle.ts metrics land
 * incrementally). The endpoint uses a deterministic per-org demo
 * fixture so SDK clients can integrate against the contract today; when
 * the live source lands, only this route's `loadTelemetry()` call site
 * changes. The pure kernel + the contract are stable.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import {
  computeConnectorHealth,
  type ConnectorCategory,
  type ConnectorTelemetry,
} from "@/lib/connectors/connectorHealth";

export const dynamic = "force-dynamic";

interface ConnectorRow {
  name: string;
  category: ConnectorCategory;
  telemetry: ConnectorTelemetry;
}

/**
 * Stable per-org demo telemetry. Same org id → same numbers across
 * polls (no Math.random) so a customer's dashboard doesn't shimmer.
 */
function loadTelemetry(orgId: string, now: Date): ReadonlyArray<ConnectorRow> {
  const seed = hashOrg(orgId);
  const offset = (n: number) => seed % n;
  return [
    {
      name: "AWS",
      category: "cloud",
      telemetry: {
        lastSuccessfulSyncAt: new Date(now.getTime() - (60_000 + offset(120_000))),
        recentSuccessCount: 18,
        recentErrorCount:    1,
        authFailed:          false,
        rateLimitedNow:      false,
        category:           "cloud",
      },
    },
    {
      name: "GitHub",
      category: "vcs",
      telemetry: {
        lastSuccessfulSyncAt: new Date(now.getTime() - (5 * 60_000 + offset(120_000))),
        recentSuccessCount: 12,
        recentErrorCount:    0,
        authFailed:          false,
        rateLimitedNow:      false,
        category:           "vcs",
      },
    },
    {
      name: "Postgres",
      category: "db",
      telemetry: {
        // Deliberately stale to demonstrate the staleness path. Same org
        // always sees the same "10 minutes ago" — deterministic.
        lastSuccessfulSyncAt: new Date(now.getTime() - 10 * 60_000),
        recentSuccessCount:  6,
        recentErrorCount:    1,
        authFailed:          false,
        rateLimitedNow:      false,
        category:           "db",
      },
    },
    {
      name: "CloudWatch",
      category: "monitoring",
      telemetry: {
        lastSuccessfulSyncAt: new Date(now.getTime() - 60_000),
        recentSuccessCount: 30,
        recentErrorCount:    4,            // ~88% — at the edge but still healthy.
        authFailed:          false,
        rateLimitedNow:      false,
        category:           "monitoring",
      },
    },
  ];
}

function hashOrg(orgId: string): number {
  // Tiny deterministic hash so identical orgIds always produce identical
  // demo telemetry. Not cryptographic; just stability.
  let h = 5381;
  for (let i = 0; i < orgId.length; i++) h = ((h << 5) + h + orgId.charCodeAt(i)) >>> 0;
  return h;
}

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function GET(req: NextRequest) {
  const correlationId = `v1_connectors_health_${Date.now().toString(36)}`;

  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:read",
    correlationId,
    route: "GET /api/v1/connectors/health",
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

  const now = new Date();
  const rows = loadTelemetry(auth.organizationId, now);

  const evaluated = rows.map((r) => {
    const h = computeConnectorHealth(r.telemetry, now);
    return {
      name: r.name,
      category: r.category,
      status: h.status,
      stage: h.stage,
      reason: h.reason,
      successRatio: h.successRatio,
      ageMs: h.ageMs,
      recentSuccessCount: r.telemetry.recentSuccessCount,
      recentErrorCount:   r.telemetry.recentErrorCount,
    };
  });

  const summary = {
    healthy:      evaluated.filter((c) => c.status === "healthy").length,
    degraded:     evaluated.filter((c) => c.status === "degraded").length,
    stale:        evaluated.filter((c) => c.status === "stale").length,
    auth_failed:  evaluated.filter((c) => c.status === "auth_failed").length,
    rate_limited: evaluated.filter((c) => c.status === "rate_limited").length,
  };

  return NextResponse.json({
    ok: true,
    generatedAt: now.toISOString(),
    summary,
    connectors: evaluated,
  });
}
