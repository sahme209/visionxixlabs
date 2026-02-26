import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { generateWebsiteStarter } from "@/lib/websiteStarter/engine";
import type { LeadFormData } from "@/lib/leads/leadSchema";

/**
 * POST /api/admin/leads/[id]/starter
 * Regenerate AI Website Starter Package for a lead. Admin only.
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
    const data = payload as unknown as LeadFormData;

    const pkg = await generateWebsiteStarter({ variant: "detailed", form: data }, "free");
    const merged = { ...payload, aiStarterPackage: pkg, aiStarterError: false };
    await prisma.lead.update({ where: { id }, data: { fullPayload: merged as object } });

    return NextResponse.json({ success: true, aiStarterPackage: pkg });
  } catch (e) {
    console.error("[Admin Starter Regenerate] Error:", e);
    const lead = await prisma.lead.findUnique({ where: { id } }).catch(() => null);
    if (lead) {
      const payload = lead.fullPayload as Record<string, unknown>;
      const merged = { ...payload, aiStarterError: true };
      await prisma.lead.update({ where: { id }, data: { fullPayload: merged as object } });
    }
    return NextResponse.json(
      { error: "AI generation failed. Try again or contact support." },
      { status: 500 }
    );
  }
}
