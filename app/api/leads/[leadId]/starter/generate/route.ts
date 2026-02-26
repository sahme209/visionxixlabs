import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/leads/starterToken";
import { generateWebsiteStarterPackage } from "@/lib/leads/aiWebsiteStarter";
import type { LeadFormData } from "@/lib/leads/leadSchema";

/**
 * POST /api/leads/[leadId]/starter/generate
 * Runs AI generation if not already present. Requires token in query (token=) or body (token).
 * Deterministic on serverless: caller triggers when pending.
 */
export async function POST(
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
    if (payload?.aiStarterPackage && typeof payload.aiStarterPackage === "object") {
      return NextResponse.json({
        success: true,
        alreadyPresent: true,
        aiStarterPackage: payload.aiStarterPackage,
      });
    }

    const data = payload as unknown as LeadFormData;
    const pkg = await generateWebsiteStarterPackage(data);
    const merged = { ...payload, aiStarterPackage: pkg, aiStarterError: false };
    await prisma.lead.update({ where: { id: leadId }, data: { fullPayload: merged as object } });

    return NextResponse.json({
      success: true,
      alreadyPresent: false,
      aiStarterPackage: pkg,
    });
  } catch (e) {
    console.warn("[Starter Generate] AI failed:", e instanceof Error ? e.message : String(e));
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead) {
      const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
      const merged = { ...payload, aiStarterError: true };
      await prisma.lead.update({ where: { id: leadId }, data: { fullPayload: merged as object } });
    }
    return NextResponse.json(
      { error: true, message: "AI generation failed. Our team will follow up." },
      { status: 500 }
    );
  }
}
