import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

/**
 * GET /api/leads/status?token=XXX
 * Returns status and previewUrl for a lead. Requires valid signed token.
 * Used by thank-you page to poll for preview readiness.
 */
export async function GET(req: NextRequest) {
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
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const previewUrl = payload.previewUrl as string | undefined;
    const form = (payload.form as Record<string, unknown>) || {};
    const infrastructure = (payload.infrastructure as Record<string, unknown>) || {};
    const tier = (form.tier as string) || "starter";
    const tierConfig = { starter: 3, professional: 0, done_for_you: 0 }[tier] ?? 3;
    const revisionCount = (payload.revisionCount as number) || 0;
    const revisionsRemaining = tierConfig > 0 ? Math.max(0, tierConfig - revisionCount) : null;

    return NextResponse.json({
      leadId,
      status: lead.status,
      previewUrl: previewUrl || null,
      packageReady: lead.status === "package_ready" || lead.status === "deploy_ready" || lead.status === "deploy_generating" || lead.status === "published",
      deployReady: lead.status === "deploy_ready" || lead.status === "published",
      revisionsRemaining,
      infrastructure: {
        cloudProvider: infrastructure.cloudProvider || "vercel",
        cdnEnabled: infrastructure.cdnEnabled ?? (tier !== "starter"),
        sslEnabled: infrastructure.sslEnabled ?? true,
        cicdEnabled: infrastructure.cicdEnabled ?? (tier === "professional" || tier === "done_for_you"),
        securityLevel: infrastructure.securityLevel || (tier === "done_for_you" ? "hardened" : tier === "professional" ? "standard" : "basic"),
        addOns: infrastructure.addOns || [],
      },
      form: {
        hasDomain: form.hasDomain,
        domainName: form.domainName,
      },
    });
  } catch (e) {
    console.error("[leads status GET]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
