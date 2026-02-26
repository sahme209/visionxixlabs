import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { generateWebsiteStarterPackage } from "@/lib/leads/aiWebsiteStarter";
import type { LeadFormData } from "@/lib/leads/leadSchema";

/**
 * POST /api/admin/leads/[id]/starter
 * Regenerate AI starter package. Admin only.
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

    const data = lead.fullPayload as unknown as LeadFormData;
    const pkg = await generateWebsiteStarterPackage(data);
    const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
    const merged = { ...payload, aiStarterPackage: pkg, aiStarterError: false };
    await prisma.lead.update({ where: { id }, data: { fullPayload: merged as object } });

    return NextResponse.json({ success: true, aiStarterPackage: pkg });
  } catch (e) {
    console.warn("[Admin Starter] Regenerate failed:", e instanceof Error ? e.message : String(e));
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (lead) {
      const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
      const merged = { ...payload, aiStarterError: true };
      await prisma.lead.update({ where: { id }, data: { fullPayload: merged as object } });
    }
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 });
  }
}
