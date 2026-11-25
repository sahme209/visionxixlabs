import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { generateWebsiteStarter } from "@/lib/websiteStarter/engine";
import { resolveTier } from "@/lib/websiteBuildPricing";
import { websiteBuilderTierToUnified } from "@/lib/pricing/unifiedTier";
import { websitePreviewUnavailable } from "@/lib/deploy/websitePreviewUnavailable";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";
import { LeadEngineBusyError, runAsyncLeadEngine } from "@/lib/async/engineRunner";
import { checkRateLimit } from "@/lib/rateLimit";
import { eventEngineTriggered, eventEngineCompleted, eventEngineFailed } from "@/lib/observability/events";

/**
 * POST /api/leads/trigger?token=XXX
 * Verifies the lead token and prepares its website package. Provider dispatch
 * requires a separately qualified platform governance request.
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
    const plan = payload.websiteBuilderPlan as { fullPageHtml?: string; heroHtml?: string } | undefined;
    if (lead.status === "deploy_generating" || plan?.fullPageHtml || plan?.heroHtml) {
      return websitePreviewUnavailable();
    }

    let pkg = payload.aiPackage as AIStarterPackage | undefined;
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
        async generate({ payload: currentPayload, invocation }) {
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
            tier,
            invocation
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

    eventEngineCompleted({ leadId, engineName: "website-builder", unifiedTier: "free" });
    return websitePreviewUnavailable();
  } catch (e) {
    if (e instanceof LeadEngineBusyError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    eventEngineFailed({ leadId, engineName: "website-builder", error: e instanceof Error ? e.message : String(e), unifiedTier: "free" });
    console.error("[leads trigger]", e);
    return NextResponse.json(
      { error: "Failed to prepare the website package" },
      { status: 500 }
    );
  }
}
