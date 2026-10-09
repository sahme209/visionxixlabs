import { NextResponse, type NextRequest } from "next/server";
import { loadAppEnv } from "@/lib/config/env";
import { runAirflowAutomationTick } from "@/lib/integrations/airflow/automationTick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<Response> { return handle(request); }
export async function POST(request: NextRequest): Promise<Response> { return handle(request); }

async function handle(request: NextRequest): Promise<Response> {
  const secret = loadAppEnv().cronSecret;
  if (!secret) return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "cron_unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, data: await runAirflowAutomationTick() });
}
