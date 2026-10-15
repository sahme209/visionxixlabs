import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { reconcileWebsiteDeployment, websiteDeploymentPending } from "@/lib/deploy/reconcileWebsiteDeployment";
import { buildEngineStatusResponse } from "@/lib/async/statusBuilder";

/**
 * GET /api/leads/status?token=XXX
 * GET /api/leads/status?leadId=XXX (configured admin only)
 * Returns bounded provider observations through signed lead-token or admin authority.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  let leadId: string;
  // An explicitly supplied token always selects the public capability path.
  // Invalid/empty tokens must never fall back to an admin session.
  if (req.nextUrl.searchParams.has("token")) {
    const result = verifyStarterToken(token ?? "");
    if ("error" in result) {
      return NextResponse.json({ error: result.error === "expired" ? "Token expired" : "Invalid token" }, { status: 401 });
    }
    leadId = result.leadId;
  } else {
    const requestedLeadId = req.nextUrl.searchParams.get("leadId");
    if (!requestedLeadId) return NextResponse.json({ error: "Token or admin lead ID required" }, { status: 400 });
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;
    leadId = requestedLeadId;
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const observation = await reconcileWebsiteDeployment(lead);
    let current = lead;
    if (observation.changed) {
      const committed = await prisma.lead.updateMany({
        where: { id: lead.id, status: lead.status, fullPayload: { equals: lead.fullPayload as Prisma.InputJsonValue } },
        data: { status: observation.status, fullPayload: observation.payload as Prisma.JsonObject },
      });
      // A newer submission/revision wins over a delayed provider observation.
      current = committed.count === 1
        ? { ...lead, status: observation.status, fullPayload: observation.payload as Prisma.JsonObject }
        : await prisma.lead.findUnique({ where: { id: leadId } }) ?? lead;
    }
    const currentPayload = (current.fullPayload as Record<string, unknown>) || {};
    const base = buildEngineStatusResponse({
      lead: current,
      engineType: "website",
    });

    const deploymentPending = websiteDeploymentPending(currentPayload);
    return NextResponse.json({
      leadId,
      status: current.status,
      deploymentPending,
      previewDeployment: currentPayload.previewDeployment ?? null,
      productionDeployment: currentPayload.productionDeployment ?? null,
      ...base,
      deployReady: !deploymentPending && base.deployReady === true,
    });
  } catch (e) {
    console.error("[leads status GET]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
