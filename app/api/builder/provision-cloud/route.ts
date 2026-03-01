/**
 * POST /api/builder/provision-cloud
 * Provisions optional cloud services for a Builder project.
 * Body: { token?, leadId?, projectId, cloudServices: string[] }
 * Requires: starter token (from lead) OR session + leadId.
 * All cloud actions require explicit user authorization (cloudServices = user selection).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { execute } from "@/lib/execution/engine";
const SERVICE_TO_PLUGIN: Record<string, string> = {
  hosting: "hosting",
  storage: "storage",
  cicd: "cicd",
  monitoring: "monitoring-logs",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, leadId, projectId, cloudServices } = body;

    const services = Array.isArray(cloudServices)
      ? (cloudServices as string[]).filter((s) =>
          ["hosting", "storage", "cicd", "monitoring"].includes(s)
        )
      : [];

    if (services.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "No cloud services to provision",
      });
    }

    let userId: string;
    let resolvedLeadId: string;
    let resolvedProjectId: string;

    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { id?: string }).id) {
      userId = (session.user as { id: string }).id;
      if (!leadId) {
        return NextResponse.json(
          { error: "leadId required when authenticated" },
          { status: 400 }
        );
      }
      resolvedLeadId = leadId;
      resolvedProjectId = projectId ?? leadId;
    } else if (token) {
      const result = verifyStarterToken(token);
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error === "expired" ? "Token expired" : "Invalid token" },
          { status: 401 }
        );
      }
      const lead = await prisma.lead.findUnique({
        where: { id: result.leadId },
        select: { userId: true, id: true },
      });
      if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      if (!lead.userId) {
        return NextResponse.json(
          { error: "Sign in to provision cloud services. Link your account first." },
          { status: 403 }
        );
      }
      userId = lead.userId;
      resolvedLeadId = lead.id;
      resolvedProjectId = projectId ?? lead.id;
    } else {
      return NextResponse.json(
        { error: "Token or session required" },
        { status: 401 }
      );
    }

    const actions = services.map((svc) => ({
      id: `provision-${svc}`,
      pluginId: SERVICE_TO_PLUGIN[svc] ?? svc,
      action: "provision",
      params: { projectId: resolvedProjectId, provider: "vercel" },
      approvalRequired: false,
    }));

    const { results } = await execute(
      {
        context: {
          userId,
          projectId: resolvedProjectId,
          leadId: resolvedLeadId,
        },
        actions,
        approvedActionIds: actions.map((a) => a.id),
        skipModuleCheck: true,
      },
      {},
      "builder"
    );

    const success = results.every((r) => r.success);
    return NextResponse.json({
      success,
      results: results.map((r) => ({
        actionId: r.actionId,
        pluginId: r.pluginId,
        success: r.success,
        error: r.error,
      })),
    });
  } catch (e) {
    console.error("[builder provision-cloud]", e);
    return NextResponse.json(
      { error: "Failed to provision cloud services" },
      { status: 500 }
    );
  }
}
