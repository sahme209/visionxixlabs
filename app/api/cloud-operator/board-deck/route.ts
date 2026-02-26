import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { resolveOperatorTier, hasEnterpriseEngagement } from "@/lib/cloudOperator/pricing";
import { generateBoardSlideOutline } from "@/lib/axiom/boardDeck";
import type { StrategicBrief } from "@/lib/axiom/strategicBrief";

/**
 * Phase 8: GET /api/cloud-operator/board-deck?token=XXX
 * Returns board slide outline. Enterprise only.
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

  const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
  if (!lead || lead.source !== "cloud-operator") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const tier = resolveOperatorTier(payload.tier as string);

  if (!hasEnterpriseEngagement(tier)) {
    return NextResponse.json(
      { error: "Board deck is available for Enterprise tier only" },
      { status: 403 }
    );
  }

  const axiomResult = payload.axiomResult as { strategicBrief?: StrategicBrief } | undefined;
  const brief = axiomResult?.strategicBrief;
  if (!brief) {
    return NextResponse.json(
      { error: "Generate strategic brief first by visiting the Strategic tab" },
      { status: 400 }
    );
  }

  const deck = generateBoardSlideOutline(brief);
  return NextResponse.json(deck);
}
