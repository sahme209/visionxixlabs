import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { buildEngineStatusResponse } from "@/lib/async/statusBuilder";

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

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }
  const leadId = result.leadId;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const base = buildEngineStatusResponse({
      lead,
      engineType: "website",
    });

    return NextResponse.json({
      leadId,
      status: lead.status,
      ...base,
    });
  } catch (e) {
    console.error("[leads status GET]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
