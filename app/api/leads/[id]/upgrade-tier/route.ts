import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WEBSITE_BUILD_TIERS, resolveTier } from "@/lib/websiteBuildPricing";

/**
 * POST /api/leads/[id]/upgrade-tier — Admin: update lead tier.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Lead ID required" }, { status: 400 });

  let body: { tier?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawTier = String(body.tier || "").trim();
  const tier = resolveTier(rawTier);
  if (!(tier in WEBSITE_BUILD_TIERS)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const form = (payload.form as Record<string, unknown>) || {};
    const updatedPayload = { ...payload, form: { ...form, tier } };

    await prisma.lead.update({
      where: { id },
      data: { fullPayload: updatedPayload },
    });

    return NextResponse.json({ success: true, tier });
  } catch (e) {
    console.error("[upgrade-tier]", e);
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 });
  }
}
