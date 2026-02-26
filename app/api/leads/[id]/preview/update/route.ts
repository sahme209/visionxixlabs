import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateWebsiteStarterWithChanges } from "@/lib/websiteStarter/engine";
import { deployPreview } from "@/lib/previewDeploy";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";
import { WEBSITE_BUILD_TIERS, resolveTier } from "@/lib/websiteBuildPricing";

/**
 * POST /api/leads/[id]/preview/update?token=XXX
 * Body: { changeRequest: string }
 * Regenerates AI content based on change request, redeploys preview.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const rateLimitKey = `preview-update:${token.slice(0, 32)}`;
  if (!checkRateLimit(rateLimitKey)) {
    return NextResponse.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
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

  let body: { changeRequest?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const changeRequest = String(body.changeRequest || "").trim().slice(0, 2000);
  if (!changeRequest) {
    return NextResponse.json({ error: "Change request is required" }, { status: 400 });
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const pkg = payload.aiPackage as AIStarterPackage | undefined;

    if (!pkg) {
      return NextResponse.json(
        { error: "Preview not ready yet. Please wait for initial generation." },
        { status: 400 }
      );
    }

    const form = (payload.form as Record<string, unknown>) || {};
    const tier = resolveTier((form.tier as string) || "starter");
    const tierConfig = WEBSITE_BUILD_TIERS[tier] ?? WEBSITE_BUILD_TIERS.starter;
    const revisionCount = (payload.revisionCount as number) || 0;

    if (tierConfig.revisions > 0 && revisionCount >= tierConfig.revisions) {
      return NextResponse.json(
        { error: `Revision limit (${tierConfig.revisions}) reached. Upgrade for more revisions.` },
        { status: 400 }
      );
    }

    await prisma.lead.update({
      where: { id },
      data: { status: "deploy_generating" },
    });

    const formData = {
      name: form.name as string,
      email: (form.email as string) || lead.email,
      company: form.company as string,
      message: form.message as string,
      industry: form.industry as string,
      hasDomain: form.hasDomain as boolean,
      domainName: form.domainName as string,
    };
    const updatedPkg = await generateWebsiteStarterWithChanges(pkg, formData, changeRequest);

    const projectName = `preview-${id.slice(-8)}`;
    const deployResult = await deployPreview(updatedPkg, projectName);

    const updatedPayload = {
      ...payload,
      aiPackage: updatedPkg,
      previewUrl: deployResult.url,
      vercelDeploymentId: deployResult.deploymentId,
      revisionCount: revisionCount + 1,
      lastChangeRequest: changeRequest,
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
      previewUrl: deployResult.url,
      revisionsRemaining: tierConfig.revisions > 0 ? tierConfig.revisions - revisionCount - 1 : null,
    });
  } catch (e) {
    console.error("[preview update]", e);
    await prisma.lead
      .update({ where: { id }, data: { status: "deploy_ready" } })
      .catch(() => {});
    return NextResponse.json(
      { error: "Failed to update preview" },
      { status: 500 }
    );
  }
}
