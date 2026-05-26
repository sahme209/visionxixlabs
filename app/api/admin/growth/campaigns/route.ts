/**
 * GET  /api/admin/growth/campaigns   — list campaigns
 * POST /api/admin/growth/campaigns   — create campaign
 *
 * Internal only. Accepts form-encoded POST from /admin/growth/campaigns.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { parseFormOrJson } from "@/lib/growth/parseBody";
import { writeGrowthAudit } from "@/lib/growth/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  const rows = await prisma.growthCampaign.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { drafts: true } } },
  });
  return NextResponse.json({
    ok: true,
    total: rows.length,
    campaigns: rows.map((c) => ({
      id: c.id,
      name: c.name,
      theme: c.theme,
      status: c.status,
      hypothesis: c.hypothesis,
      startsAt: c.startsAt.toISOString(),
      endsAt:   c.endsAt.toISOString(),
      draftCount: c._count.drafts,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  const body = await parseFormOrJson(req);
  const name = (body.name ?? "").trim();
  const theme = (body.theme ?? "product_education").trim();
  const hypothesis = (body.hypothesis ?? "").trim();
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt   = body.endsAt   ? new Date(body.endsAt)   : null;

  if (!name || !startsAt || !endsAt || isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
    return NextResponse.json({ ok: false, error: "missing_fields", required: ["name", "startsAt", "endsAt"] }, { status: 400 });
  }

  const created = await prisma.growthCampaign.create({
    data: { name, theme, hypothesis, startsAt, endsAt, status: "planned" },
  });

  await writeGrowthAudit({
    actor: gate.user.email ?? "admin",
    action: "campaign.created",
    targetKind: "growth_campaign",
    targetId: created.id,
    detail: { theme, days: Math.round((endsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24)) },
  });

  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    return NextResponse.redirect(new URL("/admin/growth/campaigns", req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, campaign: created });
}
