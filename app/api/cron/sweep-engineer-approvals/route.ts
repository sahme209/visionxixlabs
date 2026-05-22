/**
 * GET/POST /api/cron/sweep-engineer-approvals
 *
 * Vercel cron entry-point for the engineer-approval expiry sweeper.
 * Transitions pending EngineerApprovalSnapshot rows older than the
 * TTL (default 24h, env-overridable) to status="expired" and emits
 * an engineer.approval_expired audit row per transition.
 *
 * Guarded by Authorization: Bearer ${CRON_SECRET}. Returns 503 when
 * the secret is not configured so we cannot accidentally run a public
 * sweeper.
 */

import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { sweepExpiredApprovals } from "@/lib/workforce/sweepExpiredApprovals";
import { resolveApprovalTtlMs } from "@/lib/workforce/approvalExpiry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const env = loadAppEnv();

  if (!env.cronSecret) {
    return NextResponse.json(
      { ok: false, reason: "cron_not_configured", detail: "CRON_SECRET is not set — sweeper refuses to run." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json(
      { ok: false, reason: "cron_unauthorized" },
      { status: 401 },
    );
  }

  const ttlMs = resolveApprovalTtlMs(process.env.WORKFORCE_APPROVAL_TTL_MS);
  const result = await sweepExpiredApprovals({ ttlMs });

  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    expired: result.expired,
    ttlMs: result.ttlMs,
    expiredIds: result.expiredIds,
    sweptAt: new Date().toISOString(),
  });
}
