import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { reconcilePendingGatewayUsage } from "@/lib/billing/reconcileGatewayUsage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = loadAppEnv().cronSecret;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_not_configured" }, { status: 503 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  const result = await reconcilePendingGatewayUsage();
  return NextResponse.json({ ok: true, ...result, reconciledAt: new Date().toISOString() });
}
