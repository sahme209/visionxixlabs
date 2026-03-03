import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkTieredRateLimit } from "@/lib/rateLimitTiered";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
import { runCloudOperatorAnalysis } from "@/lib/cloudOperator/triggerCore";
import { eventEngineFailed } from "@/lib/observability/events";

/**
 * POST /api/cloud-operator/trigger?token=XXX
 * Generates AI Cloud Operator output for the request.
 * Stores result in fullPayload.operatorOutput and fullPayload.operatorScores.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  if (!checkRateLimit(`cloud-operator-trigger:${token.slice(0, 32)}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  const leadId = result.leadId;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  const tierForRate = resolveOperatorTier((lead?.fullPayload as Record<string, unknown>)?.tier as string);
  if (!checkTieredRateLimit(tierForRate, ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  try {
    const analysisResult = await runCloudOperatorAnalysis(leadId);
    const latest = await prisma.lead.findUnique({ where: { id: leadId } });
    const payload = (latest?.fullPayload as Record<string, unknown>) ?? {};
    const operatorOutput = payload.operatorOutput;
    const axiomResult = payload.axiomResult;

    return NextResponse.json({
      success: true,
      status: analysisResult.status,
      operatorOutput: operatorOutput ?? null,
      operatorScores: (operatorOutput as { scores?: unknown })?.scores ?? null,
      axiomScores: analysisResult.axiomScores,
      axiomResult: axiomResult ?? null,
    });
  } catch (e) {
    eventEngineFailed({ leadId, engineName: "cloud-operator", error: e instanceof Error ? e.message : String(e), unifiedTier: tierForRate });
    return NextResponse.json(
      { error: "Failed to generate output. Please try again." },
      { status: 500 }
    );
  }
}
