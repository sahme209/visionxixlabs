import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

/**
 * Phase 5: GET /api/connectors/status?token=
 * Returns connector status (no credentials, only metadata).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const connectors = (payload.connectors as Record<string, unknown>) || {};

    const status: Record<string, { status: string; linkedAt?: string }> = {};
    for (const [k, v] of Object.entries(connectors)) {
      const meta = v as Record<string, unknown>;
      status[k] = {
        status: (meta.status as string) || "pending",
        linkedAt: meta.linkedAt as string | undefined,
      };
    }

    return NextResponse.json({ success: true, connectors: status });
  } catch (e) {
    console.error("[connectors status]", e);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
