/**
 * GET /api/v1/events/stream — Phase 409.
 *
 * Server-Sent Events endpoint. Replaces the desktop's 5s + 30s ambient
 * polls with a single long-lived push connection. Each tick the
 * endpoint reads canonical snapshots from the same DB the polling
 * endpoints use and emits SSE frames for whatever the subscriber asked
 * for via `?subscribe=`.
 *
 * Required scope: pipeline:read.
 *
 * Why not native EventSource auth: the browser EventSource API doesn't
 * support custom headers. The desktop client uses fetch + ReadableStream
 * parsing (see desktop/src/lib/useSseStream.ts) which DOES support
 * Authorization: Bearer — keeping a single auth model across all v1
 * endpoints rather than minting query-string tokens.
 *
 * Connection lifecycle:
 *   1. Auth + scope → 401 / 403 / 429 before any stream byte is written.
 *   2. Emit `stream.ready` immediately so clients know the channel is
 *      live (and can stop a "no data yet" spinner).
 *   3. Every 1s, decide via planTick() which kinds fire this tick.
 *   4. Heartbeats fire every 25s to keep any intermediate proxy from
 *      idling the connection out.
 *   5. On client disconnect (`req.signal.aborted`), tear down the
 *      interval — Vercel's runtime would let the timer dangle otherwise.
 *   6. Emit `stream.shutdown` on graceful close so the desktop logs a
 *      clean "stream closed" rather than reconnect-spamming.
 *
 * Pure logic lives in lib/events/streamKernel.ts — this file is the IO
 * boundary that composes it with Prisma + setInterval.
 */

import type { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/security/authenticateApiKey";
import { prisma } from "@/lib/db";
import {
  formatSseFrame,
  parseEventFilter,
  planTick,
  shouldEmit,
  type StreamEventKind,
} from "@/lib/events/streamKernel";
import {
  computeConnectorHealth,
  type ConnectorCategory,
} from "@/lib/connectors/connectorHealth";

export const dynamic = "force-dynamic";
// SSE requires a long-lived response — opt into Node runtime since
// Edge's stream lifetime caps are more aggressive.
export const runtime = "nodejs";

function getSourceIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function GET(req: NextRequest) {
  const correlationId = `v1_events_stream_${Date.now().toString(36)}`;

  const auth = await authenticateApiKey({
    authorizationHeader: req.headers.get("authorization"),
    sourceIp: getSourceIp(req),
    requiredScope: "pipeline:read",
    correlationId,
    route: "GET /api/v1/events/stream",
  });
  if (!auth.ok) {
    const headers: Record<string, string> = {};
    if (typeof auth.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(auth.retryAfterSeconds);
    }
    return Response.json(
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
  const filter = parseEventFilter(url.searchParams.get("subscribe"));

  let eventId = 0;
  const orgId = auth.organizationId;
  const openedAt = Math.floor(Date.now() / 1000);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (kind: StreamEventKind, data: unknown) => {
        if (!shouldEmit(kind, filter)) return;
        eventId++;
        try {
          controller.enqueue(encoder.encode(formatSseFrame({ kind, data, id: eventId })));
        } catch {
          // Controller already closed (client disconnect race) — ignore.
        }
      };

      // 1. Greet the client so it can resolve its "connecting…" state.
      send("stream.ready", {
        correlationId,
        filter: filter === null ? "*" : Array.from(filter),
        scopes: auth.scopes,
      });

      // 2. Fire one full snapshot of everything immediately so the
      //    consumer doesn't wait up to 30s for the first connectors tick.
      await emitApprovalsSnapshot(orgId, send);
      await emitConnectorsSnapshot(orgId, send);

      // 3. Tick loop. setInterval at 1s so planTick() can decide cadence
      //    per kind. AbortSignal teardown stops the interval cleanly.
      const interval = setInterval(async () => {
        if (req.signal.aborted) {
          clearInterval(interval);
          try {
            send("stream.shutdown", { reason: "client_disconnect" });
            controller.close();
          } catch { /* already closed */ }
          return;
        }

        const secs = Math.floor(Date.now() / 1000) - openedAt;
        const tick = planTick(secs);
        try {
          if (tick.emitHeartbeat) {
            send("heartbeat", { atSec: secs });
          }
          if (tick.emitApprovalsSnapshot) {
            await emitApprovalsSnapshot(orgId, send);
          }
          if (tick.emitConnectorsSnapshot) {
            await emitConnectorsSnapshot(orgId, send);
          }
        } catch {
          // Any DB blip — keep the stream open, the next tick will retry.
        }
      }, 1000);

      // Hard upper bound: 5 minutes per connection. Even with keep-alive
      // Vercel will eventually close serverless function executions.
      // Letting the client see a clean shutdown + reconnect beats a
      // half-state error.
      const maxLifetime = setTimeout(() => {
        clearInterval(interval);
        try {
          send("stream.shutdown", { reason: "max_lifetime_reached" });
          controller.close();
        } catch { /* already closed */ }
      }, 5 * 60 * 1000);

      // AbortSignal listener — fires on actual client TCP disconnect.
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearTimeout(maxLifetime);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering on upstream proxies
    },
  });
}

// ─── Snapshot fetchers ──────────────────────────────────────────────
//
// Same data the polling endpoints return — just pushed instead of
// pulled. Wrapped in best-effort catches so a per-tick DB blip never
// closes the stream.

type SseSend = (kind: StreamEventKind, data: unknown) => void;

async function emitApprovalsSnapshot(orgId: string, send: SseSend): Promise<void> {
  try {
    const rows = await prisma.pipelineRun.findMany({
      where: { organizationId: orgId, status: "awaiting_approval" },
      orderBy: { startedAt: "desc" },
      take: 100,
      select: {
        id: true, pipelineId: true, triggeredBy: true,
        startedAt: true, _count: { select: { stages: true } },
      },
    });
    send("approvals.snapshot", {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      runs: rows.map((r) => ({
        id: r.id,
        pipelineId: r.pipelineId,
        triggeredBy: r.triggeredBy,
        startedAt: r.startedAt,
        stageCount: r._count.stages,
      })),
    });
  } catch { /* best-effort */ }
}

async function emitConnectorsSnapshot(orgId: string, send: SseSend): Promise<void> {
  // Today's connector telemetry is the same deterministic per-org fixture
  // the polling endpoint serves; when live metrics land, only this
  // function changes. The stream contract stays stable.
  const now = new Date();
  const seed = djb2(orgId);
  const rows: ReadonlyArray<{
    name: string; category: ConnectorCategory;
    lastAt: Date | null; ok: number; err: number; auth: boolean; rate: boolean;
  }> = [
    { name: "AWS",        category: "cloud",      lastAt: new Date(now.getTime() - (60_000 + (seed % 120_000))),  ok: 18, err: 1, auth: false, rate: false },
    { name: "GitHub",     category: "vcs",        lastAt: new Date(now.getTime() - (5 * 60_000 + (seed % 120_000))), ok: 12, err: 0, auth: false, rate: false },
    { name: "Postgres",   category: "db",         lastAt: new Date(now.getTime() - 10 * 60_000),                  ok:  6, err: 1, auth: false, rate: false },
    { name: "CloudWatch", category: "monitoring", lastAt: new Date(now.getTime() - 60_000),                       ok: 30, err: 4, auth: false, rate: false },
  ];
  const evaluated = rows.map((r) => {
    const h = computeConnectorHealth({
      lastSuccessfulSyncAt: r.lastAt,
      recentSuccessCount: r.ok,
      recentErrorCount: r.err,
      authFailed: r.auth,
      rateLimitedNow: r.rate,
      category: r.category,
    }, now);
    return {
      name: r.name, category: r.category,
      status: h.status, stage: h.stage, reason: h.reason,
      successRatio: h.successRatio, ageMs: h.ageMs,
      recentSuccessCount: r.ok, recentErrorCount: r.err,
    };
  });
  const summary = {
    healthy:      evaluated.filter((c) => c.status === "healthy").length,
    degraded:     evaluated.filter((c) => c.status === "degraded").length,
    stale:        evaluated.filter((c) => c.status === "stale").length,
    auth_failed:  evaluated.filter((c) => c.status === "auth_failed").length,
    rate_limited: evaluated.filter((c) => c.status === "rate_limited").length,
  };
  send("connectors.snapshot", {
    generatedAt: now.toISOString(),
    summary,
    connectors: evaluated,
  });
}

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
