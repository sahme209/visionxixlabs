import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

const UNLOCK_PRICE_CENTS = 2900; // $29 one-time
const UNLOCK_EXPIRY_DAYS = 365;

/**
 * Phase 6: One-time "Full Roadmap Unlock" ($29).
 * POST /api/cloud-operator/unlock?token=XXX
 * Creates unlock record; status endpoint treats unlock as Pro for this lead.
 */
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
    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
    });
    if (!lead || lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + UNLOCK_EXPIRY_DAYS);

    const unlock = {
      type: "roadmap" as const,
      paid: true as const,
      paidAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      priceCents: UNLOCK_PRICE_CENTS,
    };

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        fullPayload: {
          ...payload,
          unlock,
        } as object,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Full Roadmap Unlock activated.",
      unlock: {
        type: unlock.type,
        expiresAt: unlock.expiresAt,
      },
    });
  } catch (e) {
    console.error("[cloud-operator unlock]", e);
    return NextResponse.json(
      { error: "Failed to apply unlock" },
      { status: 500 }
    );
  }
}
