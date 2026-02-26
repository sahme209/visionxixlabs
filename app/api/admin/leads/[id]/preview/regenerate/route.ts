import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { deployPreview } from "@/lib/leads/previewDeploy";
import type { AiStarterPackage } from "@/lib/leads/aiWebsiteStarter";

/**
 * POST /api/admin/leads/[id]/preview/regenerate
 * Regenerate preview site. Admin only.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(_req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = lead.fullPayload as Record<string, unknown>;
    const pkg = payload?.aiStarterPackage as AiStarterPackage | undefined;
    if (!pkg || typeof pkg !== "object") {
      return NextResponse.json(
        { error: "AI Starter Package not ready. Regenerate AI first." },
        { status: 400 }
      );
    }

    const businessName =
      (payload?.businessName as string) ||
      (payload?.fullName as string) ||
      "Your Business";

    const result = await deployPreview(id, pkg, businessName, "preview");
    const merged = { ...payload, previewUrl: result.url, previewDeploymentId: result.deploymentId, previewStatus: "ready" };
    await prisma.lead.update({ where: { id }, data: { fullPayload: merged as object } });

    return NextResponse.json({ success: true, previewUrl: result.url });
  } catch (e) {
    console.warn("[Admin Preview] Regenerate failed:", e instanceof Error ? e.message : String(e));
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (lead) {
      const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
      const merged = { ...payload, previewStatus: "error" };
      await prisma.lead.update({ where: { id }, data: { fullPayload: merged as object } });
    }
    return NextResponse.json({ error: "Preview regeneration failed" }, { status: 500 });
  }
}
