/**
 * GET /api/plugins/list?track=builder|axiom
 * List plugins for a product track (for UI add-on selection).
 */

import { NextRequest, NextResponse } from "next/server";
import { listPluginsForTrack } from "@/lib/plugins";

export async function GET(req: NextRequest) {
  const track = (req.nextUrl.searchParams.get("track") ?? "builder") as "builder" | "axiom";
  if (track !== "builder" && track !== "axiom") {
    return NextResponse.json({ error: "track must be builder or axiom" }, { status: 400 });
  }
  const plugins = listPluginsForTrack(track).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    billingImpactCents: p.billingImpactCents,
  }));
  return NextResponse.json({ plugins });
}
