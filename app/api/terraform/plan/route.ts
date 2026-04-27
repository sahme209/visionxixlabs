/**
 * POST /api/terraform/plan
 * Run terraform init + validate + plan on a generated job.
 * Requires starter token. Plan runs automatically (no approval needed).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { terraformPlan } from "@/lib/terraform/runner";

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!checkRateLimit(`terraform-plan:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body.jobId;
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
    if (!job || job.leadId !== result.leadId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const planResult = await terraformPlan(jobId);

    return NextResponse.json({
      success: planResult.success,
      output: planResult.output,
      summary: planResult.summary,
      status: planResult.success ? "planned" : "failed",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan failed";
    console.error("[terraform/plan]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
