import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Phase 7: GET /api/user/leads
 * Returns all leads for the logged-in user.
 * Requires authentication.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const leads = await prisma.lead.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        source: true,
        status: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        fullPayload: true,
      },
    });

    return NextResponse.json({
      leads: leads.map((l) => ({
        id: l.id,
        source: l.source,
        status: l.status,
        email: l.email,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        tier: (l.fullPayload as Record<string, unknown>)?.tier ?? null,
      })),
    });
  } catch (e) {
    console.error("[user/leads]", e);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
