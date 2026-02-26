import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deployPreview } from "@/lib/previewDeploy";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";

/**
 * POST /api/leads/[id]/deploy-preview — Trigger preview deployment to Vercel.
 * Requires lead to have package_ready status.
 * Updates fullPayload with previewUrl and vercelDeploymentId.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    await prisma.lead.update({
      where: { id },
      data: { status: "deploy_generating" },
    });

    const projectName = `preview-${id.slice(-8)}`;
    const result = await deployPreview(pkg, projectName);

    const updatedPayload = {
      ...payload,
      previewUrl: result.url,
      vercelDeploymentId: result.deploymentId,
    };

    await prisma.lead.update({
      where: { id },
      data: {
        status: "deploy_ready",
        fullPayload: updatedPayload,
      },
    });

    return NextResponse.json({
      success: true,
      status: "deploy_ready",
      previewUrl: result.url,
    });
  } catch (e) {
    console.error("[leads deploy-preview]", e);
    await prisma.lead
      .update({ where: { id }, data: { status: "package_ready" } })
      .catch(() => {});
    return NextResponse.json(
      { error: "Failed to deploy preview" },
      { status: 500 }
    );
  }
}
