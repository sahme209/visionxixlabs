/**
 * POST /api/terraform/approve
 * Approve a planned Terraform job for apply.
 * Requires "CONFIRM APPLY" confirmation phrase.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

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

    await prisma.terraformExecutionJob.update({
      where: { id: jobId },
      data: {
        status: "awaiting_approval",
        approvedAt: new Date(),
        approvedBy: result.leadId,
      },
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: "awaiting_approval",
      message: "Job approved. You may now run apply.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Approval failed";
    console.error("[terraform/approve]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
