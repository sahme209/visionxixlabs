import { NextRequest, NextResponse } from "next/server";
import { leadGenerationRecovery } from "@/lib/async/generationRecovery";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/leads/starterToken";

/**
 * GET /api/leads/[id]/starter?token=...
 * Returns AI Website Starter Package. Requires signed token.
 * Returns { pending: true } if AI has not finished yet; { error: true } if AI failed.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const result = verifyStarterToken(token ?? "");
  if ("error" in result || result.leadId !== id) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = lead.fullPayload as Record<string, unknown>;
    const pkg = payload?.aiStarterPackage;
    const error = payload?.aiStarterError;
    const starterEngine = payload?.starterEngine as { outputStatus?: string } | undefined;
    const generationRecovery = starterEngine && leadGenerationRecovery(lead.status, payload, "starterEngine");

    if (pkg && typeof pkg === "object") return NextResponse.json({ aiStarterPackage: pkg });
    if (error === true || starterEngine?.outputStatus === "failed") {
      return NextResponse.json({ error: true, message: "AI generation failed. Our team will follow up.", generationRecovery });
    }
    return NextResponse.json({ pending: true, generationRecovery });
  } catch (e) {
    console.error("[Leads Starter API] Error:", e);
    return NextResponse.json({ error: "Failed to load starter package" }, { status: 500 });
  }
}
