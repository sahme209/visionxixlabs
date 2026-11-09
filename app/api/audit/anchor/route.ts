/**
 * Audit seal anchors (A9.8 decision 7). Read-only; any accepted member, as with verify.
 *
 * GET  /api/audit/anchor?organizationId=…   Download the latest seal's anchor file
 *                                           to keep outside Axiom.
 * POST /api/audit/anchor  { organizationId, anchor }
 *                                           Check a kept anchor against the live chain.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { buildSealAnchor, checkSealAnchor } from "@/lib/audit/sealAnchorKernel";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY_BYTES = 8_192;

async function caller(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await caller();
  if (!userId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!await authorizedForOrganization(userId, organizationId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const latest = await prisma.auditSeal.findFirst({ where: { organizationId: organizationId! }, orderBy: { sequence: "desc" } }).catch(() => undefined);
  if (latest === undefined) return NextResponse.json({ ok: false, error: "anchor_unavailable" }, { status: 503, headers: NO_STORE });
  if (!latest) return NextResponse.json({ ok: false, error: "no_seals_yet" }, { status: 404, headers: NO_STORE });
  const anchor = buildSealAnchor(latest, new Date());
  return new NextResponse(JSON.stringify(anchor, null, 2) + "\n", {
    headers: { ...NO_STORE, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="axiom-audit-anchor-${anchor.sequence}.json"` },
  });
}

export async function POST(req: NextRequest) {
  const userId = await caller();
  if (!userId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false, error: "anchor_too_large" }, { status: 413 });
  let body: { organizationId?: unknown; anchor?: unknown } | null = null;
  try { body = JSON.parse(text); } catch { /* handled below */ }
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  if (!await authorizedForOrganization(userId, body.organizationId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const seals = await prisma.auditSeal.findMany({ where: { organizationId: body.organizationId as string }, select: { sequence: true, sealHash: true }, orderBy: { sequence: "asc" }, take: 10_000 }).catch(() => null);
  if (!seals) return NextResponse.json({ ok: false, error: "anchor_unavailable" }, { status: 503, headers: NO_STORE });
  return NextResponse.json({ ok: true, result: checkSealAnchor(body.anchor, body.organizationId as string, seals) }, { headers: NO_STORE });
}
