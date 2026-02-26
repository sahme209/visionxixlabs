import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/leads/starterToken";
import { aiStarterToMarkdown } from "@/lib/websiteStarter/engine";
import type { AiStarterPackage } from "@/lib/websiteStarter/engine";

/**
 * GET /api/leads/[id]/starter/download?token=...
 * Returns markdown file download. Requires signed token.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const result = verifyStarterToken(token ?? "");
  if ("error" in result || result.leadId !== id) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
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
        { error: "Starter package not ready. Please try again in a moment." },
        { status: 202 }
      );
    }

    const businessName = (payload?.businessName as string) || lead.name || "";
    const markdown = aiStarterToMarkdown(pkg, businessName);
    const filename = `website-starter-${id.slice(0, 8)}.md`;

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
