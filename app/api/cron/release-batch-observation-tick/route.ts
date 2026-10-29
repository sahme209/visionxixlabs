import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { runReleaseBatchObservationTick } from "@/lib/agent/workflows/releaseBatchObservationTick";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function handle(request: NextRequest) {
  const secret = loadAppEnv().cronSecret;
  if (!secret) return reply({ ok: false, error: "cron_not_configured" }, 503);
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply({ ok: false, error: "cron_unauthorized" }, 401);
  try { return reply({ ok: true, data: await runReleaseBatchObservationTick() }); }
  catch { return reply({ ok: false, error: "batch_observation_tick_unavailable" }, 502); }
}
export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
