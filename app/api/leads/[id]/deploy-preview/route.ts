import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { deployPreview } from "@/lib/previewDeploy";
import { websiteDeploymentUpdate } from "@/lib/deploy/websiteDeploymentState";
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
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Lead ID required" }, { status: 400 });

  let previousStatus: string | undefined;
  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    previousStatus = lead.status;
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

    const update = websiteDeploymentUpdate({ result, payload, previousStatus: lead.status, kind: "preview" });
    await prisma.lead.update({ where: { id }, data: { status: update.status, fullPayload: update.payload as Prisma.InputJsonObject } });
    return NextResponse.json({ success: true, status: update.status, deploymentPending: !update.ready, previewUrl: update.payload.previewUrl ?? null, deployStatus: update.payload.deployStatus });
  } catch (e) {
    console.error("[leads deploy-preview]", e);
    if (previousStatus) await prisma.lead
      .update({ where: { id }, data: { status: previousStatus } })
      .catch(() => {});
    return NextResponse.json(
      { error: "Failed to deploy preview" },
      { status: 500 }
    );
  }
}
