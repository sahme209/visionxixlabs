/**
 * POST /api/impact/preview  Body: { paths: string[] }
 * Change impact preview (A13): areas touched, blast radius, rollback outlook and
 * reviewer checks from file paths. Pure computation; nothing is read or stored.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { previewImpact } from "@/lib/impact/impactKernel";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as { id?: string } | undefined)?.id) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const body = await req.json().catch(() => null) as { paths?: unknown } | null;
  if (!Array.isArray(body?.paths) || body.paths.length === 0 || body.paths.length > 5000) return NextResponse.json({ ok: false, error: "paths_required" }, { status: 400 });
  return NextResponse.json({ ok: true, impact: previewImpact(body.paths.filter((p): p is string => typeof p === "string")) }, { headers: { "Cache-Control": "no-store" } });
}
