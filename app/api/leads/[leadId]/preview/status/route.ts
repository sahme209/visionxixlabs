import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/leads/starterToken";

/**
 * GET /api/leads/[leadId]/preview/status?token=
 * Returns preview URL if deployed, or pending. Requires token.
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
    const previewUrl = payload?.previewUrl as string | undefined;
    if (previewUrl && typeof previewUrl === "string") {
      return NextResponse.json({ pending: false, previewUrl });
    }
    return NextResponse.json({ pending: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
