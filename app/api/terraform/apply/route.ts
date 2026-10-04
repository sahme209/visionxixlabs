/**
 * POST /api/terraform/apply
 * Execute terraform apply on an approved job.
 * Will refuse if job has not been approved via CONFIRM APPLY.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { terraformApply, legacyApplyEnabled } from "@/lib/terraform/runner";
import { logAudit } from "@/lib/security/auditLog";

export async function POST(req: NextRequest) {
  const correlationId = `terraform_apply_${crypto.randomUUID()}`;
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

    // Fail-closed gate lives here, BEFORE terraformApply() is ever called —
    // not inside it. This is a hard P0 containment: the legacy leadId-based
    // self-serve path has no tenant/role model, no environment/blast-radius
    // safeguard, and no rollback/recovery evidence. When disabled (the
    // default), terraformApply() — the function that shells out to the
    // real `terraform apply` — must never run, no DB status transition to
    // "applying" must happen, and the job's plan/approval state must be
    // left exactly as it was. A 403 + machine-readable code here, never a
    // 200, so no caller can mistake a refusal for a successful apply.
    if (!legacyApplyEnabled()) {
      await logAudit({
        leadId: result.leadId,
        action: "terraform.apply_blocked_kill_switch",
        actor: "user",
        metadata: { jobId, correlationId, reasonCode: "legacy_apply_disabled" },
      });
      return NextResponse.json({
        success: false,
        status: "blocked",
        code: "legacy_apply_disabled",
        error: "Live apply is temporarily disabled for this self-serve flow pending a security review (no tenant/role authorization model yet). Your plan and approval are saved — contact support to proceed.",
        correlationId,
      }, { status: 403 });
    }

    const applyResult = await terraformApply(jobId);

    await logAudit({
      leadId: result.leadId,
      action: applyResult.success ? "terraform.apply_succeeded" : "terraform.apply_failed",
      actor: "user",
      metadata: { jobId, correlationId, outputPreview: applyResult.output.slice(0, 500) },
    });

    return NextResponse.json({
      success: applyResult.success,
      output: applyResult.output,
      status: applyResult.success ? "succeeded" : "failed",
      correlationId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    console.error(`[${correlationId}] [terraform/apply]`, msg);
    await logAudit({
      leadId: result.leadId,
      action: "terraform.apply_failed",
      actor: "user",
      metadata: { errorMessage: msg, correlationId },
    });
    return NextResponse.json({ error: msg, correlationId }, { status: 500 });
  }
}
