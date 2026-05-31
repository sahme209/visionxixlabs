/**
 * GET /api/dashboard/ai-call-log/export.csv — Phase 537.
 *
 * Audit-handoff CSV for the AI call log. Filters mirror the live
 * surface:
 *   ?engineName=council_voter   scope to a single engine
 *   ?scope=org | global         org filter (default org)
 *   ?since=<iso>                lower bound (default last 24h)
 *
 * Columns:
 *   id, started_at, engine_name, model, outcome, error_message,
 *   latency_ms, prompt_tokens, completion_tokens, total_tokens,
 *   organization_id
 *
 * Up to 5000 rows desc by startedAt — matches the workforce + cloud
 * CSV cadence so engineers learn one shape.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function csv(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const engineName = req.nextUrl.searchParams.get("engineName") ?? null;
  const scope = req.nextUrl.searchParams.get("scope") === "global" ? "global" : "org";
  const sinceRaw = req.nextUrl.searchParams.get("since");
  const sinceParsed = sinceRaw ? new Date(sinceRaw) : null;
  const since = sinceParsed && !Number.isNaN(sinceParsed.getTime())
    ? sinceParsed
    : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

  const rows = await prisma.aiCallLog.findMany({
    where: {
      startedAt: { gte: since },
      ...(engineName ? { engineName } : {}),
      ...(scope === "org" ? { organizationId: String(ctx.organizationId) } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      startedAt: true,
      engineName: true,
      model: true,
      outcome: true,
      errorMessage: true,
      latencyMs: true,
      promptTokens: true,
      completionTokens: true,
      totalTokens: true,
      organizationId: true,
    },
  }).catch(() => []);

  const header = [
    "id", "started_at", "engine_name", "model", "outcome",
    "error_message", "latency_ms", "prompt_tokens",
    "completion_tokens", "total_tokens", "organization_id",
  ].join(",");

  const body = rows.map((r) =>
    [
      csv(r.id),
      csv(r.startedAt.toISOString()),
      csv(r.engineName),
      csv(r.model),
      csv(r.outcome),
      csv(r.errorMessage),
      csv(r.latencyMs),
      csv(r.promptTokens),
      csv(r.completionTokens),
      csv(r.totalTokens),
      csv(r.organizationId),
    ].join(","),
  );

  const csvBody = [header, ...body].join("\n");
  const filename = `axiom-ai-calls-${engineName ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
