/**
 * GET /api/terraform/jobs/[id]
 * Return job status, plan summary, and output (redacted).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { getJobStatus } from "@/lib/terraform/runner";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;

    const job = await prisma.terraformExecutionJob.findUnique({ where: { id } });
    if (!job || job.leadId !== result.leadId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const status = await getJobStatus(id);
    return NextResponse.json({ success: true, job: status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch job";
    console.error("[terraform/jobs]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
