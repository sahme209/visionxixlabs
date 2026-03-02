import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/leads/starterToken";
import { deployPreview } from "@/lib/leads/previewDeploy";
import type { AiStarterPackage } from "@/lib/leads/aiWebsiteStarter";

/**
 * POST /api/leads/[leadId]/preview/deploy?token=
 * Deploys a preview site to Vercel. Requires AI package and token.
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
    const pkg = payload?.aiStarterPackage as AiStarterPackage | undefined;
    if (!pkg || typeof pkg !== "object") {
      return NextResponse.json(
        { error: "AI Starter Package not ready. Generate it first." },
        { status: 400 }
      );
    }

    const businessName =
      (payload?.businessName as string) ||
      (payload?.fullName as string) ||
      "Your Business";
    const result = await deployPreview(leadId, pkg, businessName, "preview");

    const merged = { ...payload, previewUrl: result.url, previewDeploymentId: result.deploymentId };
    await prisma.lead.update({ where: { id: leadId }, data: { fullPayload: merged as object } });

    return NextResponse.json({
      success: true,
      previewUrl: result.url,
      deploymentId: result.deploymentId,
    });
  } catch (e) {
    console.warn("[Preview Deploy] Failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json(
      { error: "Preview deployment failed. Our team will follow up." },
      { status: 500 }
    );
  }
}
