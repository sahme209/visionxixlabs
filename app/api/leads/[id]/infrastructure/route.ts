import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

const VALID_PROVIDERS = ["managed", "aws", "azure", "gcp"] as const;

/**
 * POST /api/leads/[id]/infrastructure?token=XXX
 * Body: { provider: "managed" | "aws" | "azure" | "gcp" }
 * Saves infrastructure selection after preview is ready. Stored in fullPayload.infrastructure.cloudProvider.
 */
export async function POST(
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

  const { id } = await params;
  if (result.leadId !== id) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = String(body.provider || "managed").toLowerCase();
  if (!VALID_PROVIDERS.includes(provider as (typeof VALID_PROVIDERS)[number])) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const infrastructure = (payload.infrastructure as Record<string, unknown>) || {};

    const updatedPayload = {
      ...payload,
      infrastructure: {
        ...infrastructure,
        cloudProvider: provider === "managed" ? "managed" : provider,
      },
    };

    await prisma.lead.update({
      where: { id },
      data: { fullPayload: updatedPayload },
    });

    return NextResponse.json({
      success: true,
      provider: provider === "managed" ? "managed" : provider,
    });
  } catch (e) {
    console.error("[infrastructure POST]", e);
    return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
  }
}
