import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { generateAIStarterPackage } from "@/lib/aiWebsiteStarter";
import { resolveTier } from "@/lib/websiteBuildPricing";
import { deployPreview } from "@/lib/previewDeploy";
import type { AIStarterPackage } from "@/lib/aiWebsiteStarter";
import { runAsyncLeadEngine } from "@/lib/async/engineRunner";

/**
 * POST /api/leads/trigger?token=XXX
 * Verifies token, runs generate + deploy-preview pipeline.
 * Called by thank-you page on load (fire-and-forget). Poll status for result.
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
  const leadId = result.leadId;

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Skip if already deploy_ready or published
    if (lead.status === "deploy_ready" || lead.status === "published") {
      return NextResponse.json({ success: true, status: lead.status });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    let pkg = payload.aiPackage as AIStarterPackage | undefined;

    // 1. Generate AI package if not ready (uses shared async engine helper)
    if (!pkg || lead.status === "created" || lead.status === "package_generating") {
      const { generated } = await runAsyncLeadEngine<AIStarterPackage>({
        leadId,
        engineName: "website-builder",
        expectedSource: "website-request",
        getTier: (_, currentPayload) =>
          resolveTier(((currentPayload.form as Record<string, unknown>)?.tier as string) || "starter"),
        isReady: (currentPayload) => !!currentPayload.aiPackage,
        getExistingResult: (currentPayload) =>
          (currentPayload.aiPackage as AIStarterPackage) || null,
        async generate({ payload: currentPayload }) {
          const form = (currentPayload.form as Record<string, unknown>) || {};
          return generateAIStarterPackage({
            name: form.name as string,
            email: form.email as string,
            company: form.company as string,
            message: form.message as string,
            industry: form.industry as string,
            hasDomain: form.hasDomain as boolean,
            domainName: form.domainName as string,
          });
        },
        persist({ result: generatedPkg }) {
          return {
            aiPackage: generatedPkg,
            engine: {
              website: { aiPackage: generatedPkg },
            },
          };
        },
      });
      pkg = generated;
    }

    if (!pkg) {
      return NextResponse.json({ error: "Failed to generate package" }, { status: 500 });
    }

    // 2. Deploy preview
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "deploy_generating" },
    });

    const projectName = `preview-${leadId.slice(-8)}`;
    const form = (payload.form as Record<string, unknown>) || {};
    const tier = resolveTier((form.tier as string) || "starter");
    // Managed cloud (vercel) for initial preview; user selects AWS/Azure/GCP after preview
    const deployResult = await deployPreview(pkg, projectName, "vercel");

    const cdnEnabled = tier !== "starter";
    const sslEnabled = true;
    const cicdEnabled = tier === "professional" || tier === "enterprise";
    const securityLevel = tier === "enterprise" ? "hardened" : tier === "professional" ? "standard" : "basic";

    const finalPayload = {
      ...(payload as Record<string, unknown>),
      aiPackage: pkg,
      previewUrl: deployResult.url,
      vercelDeploymentId: deployResult.deploymentId,
      infrastructure: {
        cloudProvider: "managed", // default; user selects on thank-you page
        cdnEnabled,
        sslEnabled,
        cicdEnabled,
        securityLevel,
        addOns: [],
      },
    };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "deploy_ready",
        fullPayload: finalPayload,
      },
    });

    // Send confirmation email with preview link
    try {
      const toEmail = (form.email as string) || lead.email;
      const name = (form.name as string) || "there";
      const resendKey = process.env.RESEND_API_KEY;
      const fromHeader = process.env.RESEND_FROM_EMAIL
        ? `Vision XIX Labs <${process.env.RESEND_FROM_EMAIL}>`
        : "onboarding@resend.dev";
      if (resendKey && toEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromHeader,
            to: [toEmail],
            subject: "Your AI + Enterprise Cloud preview is ready",
            text: `Hi ${name},\n\nYour AI-built site is deployed on managed cloud and ready to view.\n\nView it here: ${deployResult.url}\n\nSelect AWS, Azure, or GCP on the thank-you page if you want a different cloud provider.\n\n— Vision XIX Labs`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #4f46e5;">Your AI + Enterprise Cloud preview is ready</h2>
                <p>Hi ${name},</p>
                <p>Your AI-built site is deployed on managed cloud. Click below to view it:</p>
                <p><a href="${deployResult.url}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">View preview</a></p>
                <p><a href="${deployResult.url}">${deployResult.url}</a></p>
                <p>If you have questions about domains or going live, just reply to this email.</p>
                <p>— Vision XIX Labs</p>
              </div>
            `,
          }),
        });
      }
    } catch (emailErr) {
      console.warn("[leads trigger] Confirmation email failed:", emailErr);
    }

    return NextResponse.json({
      success: true,
      status: "deploy_ready",
      previewUrl: deployResult.url,
    });
  } catch (e) {
    console.error("[leads trigger]", e);
    await prisma.lead
      .update({ where: { id: leadId }, data: { status: "created" } })
      .catch(() => {});
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
