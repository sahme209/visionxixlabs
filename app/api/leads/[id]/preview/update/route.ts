import { websitePreviewUnavailable } from "@/lib/deploy/websitePreviewUnavailable";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";
import { WEBSITE_BUILD_TIERS, resolveTier } from "@/lib/websiteBuildPricing";

/**
 * POST /api/leads/[id]/preview/update?token=XXX
 * Body: { changeRequest: string }
 * Validate the signed revision request before reporting dispatch availability.
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

  let body: { changeRequest?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const changeRequest = String(body?.changeRequest || "").trim().slice(0, 2000);
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

    return websitePreviewUnavailable();
  } catch (e) {
    console.error("[preview update]", e);
    return NextResponse.json(
      { error: "Failed to update preview" },
      { status: 500 }
    );
  }
}
