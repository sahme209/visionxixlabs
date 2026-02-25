import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(_req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      fullPayload: lead.fullPayload,
      status: lead.status,
      source: lead.source,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    });
  } catch (e) {
    console.error("[Admin Leads API] Error:", e);
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  const allowed = ["new", "contacted", "won", "lost"];
  if (typeof status !== "string" || !allowed.includes(status)) {
    return NextResponse.json(
      { error: "Invalid status. Use: new, contacted, won, lost" },
      { status: 400 }
    );
  }

  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({
      id: lead.id,
      status: lead.status,
      updatedAt: lead.updatedAt,
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    console.error("[Admin Leads API] Update error:", e);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}
