/**
 * POST /api/terraform/apply
 * Execute terraform apply on an approved job.
 * Will refuse if job has not been approved via CONFIRM APPLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { terraformApply } from "@/lib/terraform/runner";
import { logAudit } from "@/lib/security/auditLog";

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
  if (!checkRateLimit(`terraform-apply:${ip}`)) {
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

    const applyResult = await terraformApply(jobId);

    await logAudit({
      leadId: result.leadId,
      action: applyResult.blockedByKillSwitch
        ? "terraform.apply_blocked_kill_switch"
        : applyResult.success
          ? "terraform.apply_succeeded"
          : "terraform.apply_failed",
      actor: "user",
      metadata: { jobId, outputPreview: applyResult.output.slice(0, 500) },
    });

    return NextResponse.json({
      success: applyResult.success,
      output: applyResult.output,
      status: applyResult.success ? "succeeded" : "failed",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    console.error("[terraform/apply]", msg);
    await logAudit({
      leadId: result.leadId,
      action: "terraform.apply_failed",
      actor: "user",
      metadata: { errorMessage: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
