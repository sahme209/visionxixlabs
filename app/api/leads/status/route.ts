import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

/**
 * GET /api/leads/status?token=XXX
 * Returns status and previewUrl for a lead. Requires valid signed token.
 * Used by thank-you page to poll for preview readiness.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const leadId = verifyStarterToken(token);
  if (!leadId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const previewUrl = payload.previewUrl as string | undefined;
    const form = (payload.form as Record<string, unknown>) || {};

    return NextResponse.json({
      leadId,
      status: lead.status,
      previewUrl: previewUrl || null,
      packageReady: lead.status === "package_ready" || lead.status === "deploy_ready" || lead.status === "deploy_generating" || lead.status === "published",
      deployReady: lead.status === "deploy_ready" || lead.status === "published",
      form: {
        hasDomain: form.hasDomain,
        domainName: form.domainName,
      },
    });
  } catch (e) {
    console.error("[leads status GET]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
