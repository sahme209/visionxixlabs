import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/leads/list — Admin: list website request leads.
 * Requires ADMIN_EMAILS allowlist.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const leads = await prisma.lead.findMany({
      where: { source: "website-request" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      leads: leads.map((l) => ({
        id: l.id,
        email: l.email,
        name: l.name,
        status: l.status,
        fullPayload: l.fullPayload,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      })),
    });
  } catch (e) {
    console.error("[leads list]", e);
    return NextResponse.json({ error: "Failed to list leads" }, { status: 500 });
  }
}
