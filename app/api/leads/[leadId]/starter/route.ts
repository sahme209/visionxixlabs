import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/leads/starterToken";

/**
 * GET /api/leads/[leadId]/starter?token=
 * Returns AI Starter Package if ready, or pending. Requires valid token.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const verifiedLeadId = token ? verifyStarterToken(token) : null;
  if (!verifiedLeadId || verifiedLeadId !== leadId) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = lead.fullPayload as Record<string, unknown>;
    if (payload?.aiStarterError === true) {
      return NextResponse.json({ error: true, message: "AI generation failed" });
    }
    if (payload?.aiStarterPackage && typeof payload.aiStarterPackage === "object") {
      return NextResponse.json({
        pending: false,
        aiStarterPackage: payload.aiStarterPackage,
        previewUrl: payload.previewUrl ?? null,
      });
    }
    return NextResponse.json({ pending: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
