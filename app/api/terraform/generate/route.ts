/**
 * POST /api/terraform/generate
 * Generate Terraform files from a readiness report.
 * Requires starter token (cloud-operator session).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateTerraform } from "@/lib/terraform/generator";

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
  if (!checkRateLimit(`terraform-generate:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
      select: { id: true, userId: true, source: true },
    });

    if (!lead || lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const readinessReportId = body.readinessReportId;

    if (!readinessReportId) {
      return NextResponse.json({ error: "readinessReportId required" }, { status: 400 });
    }

    const generated = await generateTerraform({
      leadId: lead.id,
      userId: lead.userId,
      readinessReportId,
      mode: "active_passive",
      secondaryCloud: "azure",
    });

    return NextResponse.json({
      success: true,
      jobId: generated.jobId,
      files: Object.keys(generated.files),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    console.error("[terraform/generate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
