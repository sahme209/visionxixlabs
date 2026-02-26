import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const cursor = searchParams.get("cursor") || undefined;

  try {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = leads.length > limit;
    const items = hasMore ? leads.slice(0, limit) : leads;
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return NextResponse.json({
      leads: items.map((l) => {
        const payload = (l.fullPayload as Record<string, unknown>) || {};
        const form = (payload.form as Record<string, unknown>) || {};
        return {
          id: l.id,
          name: l.name,
          email: l.email,
          phone: form.phone ?? null,
          status: l.status,
        source: l.source,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        };
      }),
      nextCursor,
    });
  } catch (e) {
    console.error("[Admin Leads API] Error:", e);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
