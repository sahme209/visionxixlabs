import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { generateScaffold } from "@/lib/leads/scaffoldGenerator";
import type { AiStarterPackage } from "@/lib/websiteStarter/engine";

const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

/**
 * POST /api/admin/leads/[id]/scaffold
 * Generate Website Build Starter scaffold for a lead. Admin only.
 * Disabled in production (no local filesystem); use S3/R2/Supabase for durable storage.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(_req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  if (isProduction) {
    return NextResponse.json(
      {
        error: "Scaffold generation is disabled in production.",
        message: "Local filesystem is ephemeral on Vercel/serverless. Configure S3, R2, or Supabase storage for scaffold artifacts to enable this feature.",
      },
      { status: 503 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = lead.fullPayload as Record<string, unknown>;
    const pkg = payload?.aiStarterPackage as AiStarterPackage | undefined;

    if (!pkg || typeof pkg !== "object") {
      return NextResponse.json(
        { error: "AI Starter Package not ready. Regenerate AI output first." },
        { status: 400 }
      );
    }

    const zipPath = await generateScaffold(id, pkg);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const downloadUrl = baseUrl
      ? `${baseUrl}/api/admin/leads/${id}/scaffold/download`
      : `/api/admin/leads/${id}/scaffold/download`;

    return NextResponse.json({
      success: true,
      downloadUrl,
      message: "Scaffold generated. Use the download link to get the zip.",
    });
  } catch (e) {
    console.error("[Admin Scaffold] Error:", e);
    return NextResponse.json(
      { error: "Failed to generate scaffold." },
      { status: 500 }
    );
  }
}
