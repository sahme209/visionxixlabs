import { websitePreviewUnavailable } from "@/lib/deploy/websitePreviewUnavailable";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import type { AIStarterPackage } from "@/lib/websiteStarter/engine";

/**
 * POST /api/leads/[id]/deploy-preview — Validate admin preview eligibility.
 * Dispatch requires a qualified platform governance request.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Lead ID required" }, { status: 400 });

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const pkg = payload.aiPackage as AIStarterPackage | undefined;

    if (!pkg) {
      return NextResponse.json(
        { error: "AI package not ready. Generate package first." },
        { status: 400 }
      );
    }

    return websitePreviewUnavailable();
  } catch (e) {
    console.error("[leads deploy-preview]", e);
    return NextResponse.json(
      { error: "Failed to deploy preview" },
      { status: 500 }
    );
  }
}
