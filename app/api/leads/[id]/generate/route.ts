import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAIStarterPackage } from "@/lib/aiWebsiteStarter";

/**
 * POST /api/leads/[id]/generate — Trigger AI package generation.
 * Updates lead status and fullPayload.aiPackage when done.
 * Called async after lead creation or by admin.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Lead ID required" }, { status: 400 });

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    await prisma.lead.update({
      where: { id },
      data: { status: "package_generating" },
    });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const form = (payload.form as Record<string, unknown>) || {};

    const pkg = await generateAIStarterPackage({
      name: form.name as string,
      email: form.email as string,
      company: form.company as string,
      message: form.message as string,
      industry: form.industry as string,
      hasDomain: form.hasDomain as boolean,
      domainName: form.domainName as string,
    });

    const updatedPayload = { ...payload, aiPackage: pkg };

    await prisma.lead.update({
      where: { id },
      data: {
        status: "package_ready",
        fullPayload: updatedPayload,
      },
    });

    return NextResponse.json({ success: true, status: "package_ready" });
  } catch (e) {
    console.error("[leads generate]", e);
    await prisma.lead
      .update({ where: { id }, data: { status: "created" } })
      .catch(() => {});
    return NextResponse.json(
      { error: "Failed to generate package" },
      { status: 500 }
    );
  }
}
