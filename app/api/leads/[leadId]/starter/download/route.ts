import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiStarterToMarkdown } from "@/lib/leads/aiWebsiteStarter";
import type { AiStarterPackage } from "@/lib/leads/aiWebsiteStarter";

/**
 * GET /api/leads/[leadId]/starter/download
 * Returns markdown file download of Website Starter Package.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const payload = lead.fullPayload as Record<string, unknown>;
    const pkg = payload?.aiStarterPackage as AiStarterPackage | undefined;

    if (!pkg || typeof pkg !== "object") {
      return NextResponse.json(
        { error: "Starter package not ready. Please try again in a moment." },
        { status: 202 }
      );
    }

    const businessName = (payload?.businessName as string) || lead.name;
    const markdown = aiStarterToMarkdown(pkg, businessName);
    const filename = `website-starter-${leadId.slice(0, 8)}.md`;

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("[Leads Starter Download] Error:", e);
    return NextResponse.json({ error: "Failed to generate download" }, { status: 500 });
  }
}
