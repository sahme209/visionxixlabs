import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { describeAIUsageSettlementGate, settleAIUsageToStripe } from "@/lib/billing/settleAIUsageToStripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest) {
  const secret = loadAppEnv().cronSecret;
  if (!secret) return NextResponse.json({ ok: false, reason: "cron_not_configured" }, { status: 503 });
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }
  const gate = describeAIUsageSettlementGate();
  if (!gate.enabled) return NextResponse.json({ ok: false, reason: "settlement_disabled", detail: gate.reason }, { status: 409 });
  const result = await settleAIUsageToStripe();
  return NextResponse.json({ ok: true, ...result, settledAt: new Date().toISOString() });
}
