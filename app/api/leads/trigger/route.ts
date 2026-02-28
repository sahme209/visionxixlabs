import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { generateWebsiteStarter } from "@/lib/websiteStarter/engine";
import { resolveTier } from "@/lib/websiteBuildPricing";
import { websiteBuilderTierToUnified } from "@/lib/pricing/unifiedTier";
import { deployPreview, deployPreviewFromPlan } from "@/lib/previewDeploy";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";
import { runAsyncLeadEngine } from "@/lib/async/engineRunner";
import { checkRateLimit } from "@/lib/rateLimit";
import { eventEngineTriggered, eventEngineCompleted, eventEngineFailed } from "@/lib/observability/events";

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

  if (!checkRateLimit(`leads-trigger:${token.slice(0, 32)}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }
  const leadId = result.leadId;

  eventEngineTriggered({ leadId, engineName: "website-builder", unifiedTier: "free" });

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
    const websiteBuilderPlan = payload.websiteBuilderPlan as {
      siteName?: string;
      fullPageHtml?: string;
      heroHtml?: string;
      designLanguage?: string;
      colorPalette?: { primary: string; secondary: string; accent: string };
      sections?: Array<{ id: string; name: string; description: string }>;
      layout?: string;
      visualStyle?: string;
    } | undefined;

    // Path A: Full build from website-builder plan (Base44-style)
    if (websiteBuilderPlan?.fullPageHtml || websiteBuilderPlan?.heroHtml) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "deploy_generating" },
      });

      const projectName = `preview-${leadId.slice(-8)}`;
      const deployResult = await deployPreviewFromPlan(
        {
          siteName: websiteBuilderPlan.siteName || "Your Site",
          fullPageHtml: websiteBuilderPlan.fullPageHtml,
          heroHtml: websiteBuilderPlan.heroHtml,
          designLanguage: websiteBuilderPlan.designLanguage,
          colorPalette: websiteBuilderPlan.colorPalette,
          sections: websiteBuilderPlan.sections,
        },
        projectName,
        "vercel"
      );

      const deployManagedPending = deployResult.state === "PENDING" && !deployResult.url;
      const form = (payload.form as Record<string, unknown>) || {};
      const tier = resolveTier((form.tier as string) || "starter");
      const cdnEnabled = tier !== "starter";
      const finalPayload = {
        ...(payload as Record<string, unknown>),
        websiteBuilderPlan,
        aiPackage: {
          companyName: websiteBuilderPlan.siteName,
          tagline: websiteBuilderPlan.designLanguage,
          homepageHero: websiteBuilderPlan.siteName,
        },
        previewUrl: deployResult.url || null,
        vercelDeploymentId: deployResult.deploymentId,
        deployStatus: deployManagedPending ? "managed_pending" : undefined,
        infrastructure: {
          cloudProvider: "managed",
          cdnEnabled,
          sslEnabled: true,
          cicdEnabled: tier === "growth" || tier === "scale" || tier === "enterprise",
          securityLevel: tier === "enterprise" ? "hardened" : "standard",
          addOns: [],
        },
      };

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: deployManagedPending ? "package_ready" : "deploy_ready",
          fullPayload: finalPayload,
        },
      });

      if (!deployManagedPending) {
        try {
          const toEmail = (form.email as string) || lead.email;
          const name = (form.name as string) || "there";
          const resendKey = process.env.RESEND_API_KEY;
          // ... email logic would go here - keeping same pattern as below
        } catch {}
      }

      eventEngineCompleted({ leadId, engineName: "website-builder" });
      return NextResponse.json({ success: true, status: deployManagedPending ? "package_ready" : "deploy_ready" });
    }

    // Path B: Standard AI package flow
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
          const tier = websiteBuilderTierToUnified((form.tier as string) || "starter");
          return generateWebsiteStarter(
            {
              variant: "simple",
              form: {
                name: form.name as string,
                email: form.email as string,
                company: form.company as string,
                message: form.message as string,
                industry: form.industry as string,
                hasDomain: form.hasDomain as boolean,
                domainName: form.domainName as string,
              },
            },
            tier
          ) as Promise<AIStarterPackage>;
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

    const deployManagedPending = deployResult.state === "PENDING" && !deployResult.url;

    const cdnEnabled = tier !== "starter";
    const sslEnabled = true;
    const cicdEnabled = tier === "growth" || tier === "scale" || tier === "enterprise";
    const securityLevel = tier === "enterprise" ? "hardened" : tier === "growth" || tier === "scale" ? "standard" : "basic";

    const finalPayload = {
      ...(payload as Record<string, unknown>),
      aiPackage: pkg,
      previewUrl: deployResult.url || null,
      vercelDeploymentId: deployResult.deploymentId,
      deployStatus: deployManagedPending ? "managed_pending" : undefined,
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
        status: deployManagedPending ? "package_ready" : "deploy_ready",
        fullPayload: finalPayload,
      },
    });

    // Send confirmation email with preview link (skip when deploy is managed-pending)
    if (!deployManagedPending) {
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
    }

    eventEngineCompleted({ leadId, engineName: "website-builder", unifiedTier: "free" });
    return NextResponse.json({
      success: true,
      status: deployManagedPending ? "package_ready" : "deploy_ready",
      previewUrl: deployResult.url || null,
      deployStatus: deployManagedPending ? "managed_pending" : undefined,
    });
  } catch (e) {
    eventEngineFailed({ leadId, engineName: "website-builder", error: e instanceof Error ? e.message : String(e), unifiedTier: "free" });
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
