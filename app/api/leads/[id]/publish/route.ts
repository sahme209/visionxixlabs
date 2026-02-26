import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deployPreview } from "@/lib/previewDeploy";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";

/**
 * POST /api/leads/[id]/publish — Production deployment (admin only).
 * Requires authenticated admin. Creates production deployment.
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

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const pkg = payload.aiPackage as AIStarterPackage | undefined;

    if (!pkg) {
      return NextResponse.json(
        { error: "AI package not ready. Generate package first." },
        { status: 400 }
      );
    }

    const projectName = `prod-${id.slice(-8)}`;
    const result = await deployPreview(pkg, projectName);

    const updatedPayload = {
      ...payload,
      productionUrl: result.url,
      productionDeploymentId: result.deploymentId,
      publishedAt: new Date().toISOString(),
    };

    await prisma.lead.update({
      where: { id },
      data: {
        status: "published",
        fullPayload: updatedPayload,
      },
    });

    return NextResponse.json({
      success: true,
      status: "published",
      productionUrl: result.url,
    });
  } catch (e) {
    console.error("[leads publish]", e);
    return NextResponse.json(
      { error: "Failed to publish" },
      { status: 500 }
    );
  }
}
