import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { deployPreview } from "@/lib/leads/previewDeploy";
import type { AiStarterPackage } from "@/lib/leads/aiWebsiteStarter";

/**
 * POST /api/admin/leads/[id]/preview/publish
 * Creates a production deployment. Admin only.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(_req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = lead.fullPayload as Record<string, unknown>;
    const pkg = payload?.aiStarterPackage as AiStarterPackage | undefined;
    if (!pkg || typeof pkg !== "object") {
      return NextResponse.json(
        { error: "AI Starter Package not ready. Regenerate it first." },
        { status: 400 }
      );
    }

    const businessName =
      (payload?.businessName as string) ||
      (payload?.fullName as string) ||
      "Your Business";
    const result = await deployPreview(id, pkg, businessName, "production");

    const merged = {
      ...payload,
      productionUrl: result.url,
      productionDeploymentId: result.deploymentId,
    };
    await prisma.lead.update({ where: { id }, data: { fullPayload: merged as object } });

    return NextResponse.json({
      success: true,
      productionUrl: result.url,
      deploymentId: result.deploymentId,
    });
  } catch (e) {
    console.warn("[Admin Publish] Failed:", e instanceof Error ? e.message : String(e));
    return NextResponse.json(
      { error: "Production deployment failed" },
      { status: 500 }
    );
  }
}
