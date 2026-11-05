/**
 * POST /api/terraform/approve
 * Legacy text jobs cannot supply saved-plan/tenant approval authority.
 * A confirmation phrase proves neither current authority nor artifact identity.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { logAudit } from "@/lib/security/auditLog";
import { LEGACY_TERRAFORM_AUTHORITY_CODE, LEGACY_TERRAFORM_AUTHORITY_MESSAGE } from "@/lib/terraform/runner";

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

  try {
    const body = await req.json().catch(() => ({}));
    const { jobId, confirmation } = body;

    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    if (confirmation !== "CONFIRM APPLY") {
      return NextResponse.json(
        { error: 'Approval requires exact phrase: "CONFIRM APPLY"' },
        { status: 400 }
      );
    }

    const job = await prisma.terraformExecutionJob.findUnique({ where: { id: jobId } });
    if (!job || job.leadId !== result.leadId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "planned") {
      return NextResponse.json(
        { error: `Cannot approve job with status "${job.status}". Must be "planned".` },
        { status: 400 }
      );
    }

    try {
      await logAudit({
        leadId: result.leadId,
        action: "terraform.approval_unavailable",
        actor: "user",
        metadata: { jobId, reasonCode: LEGACY_TERRAFORM_AUTHORITY_CODE },
      });
    } catch { /* Best-effort refusal audit never changes the authority result. */ }

    return NextResponse.json({
      success: false,
      jobId,
      status: "blocked",
      code: LEGACY_TERRAFORM_AUTHORITY_CODE,
      error: LEGACY_TERRAFORM_AUTHORITY_MESSAGE,
      approval: "unavailable",
      executionEnabled: false,
    }, { status: 403 });
  } catch {
    const msg = "terraform_approval_failed";
    console.error("[terraform/approve]", msg);
    return NextResponse.json({ error: "Terraform approval request could not be completed." }, { status: 500 });
  }
}
