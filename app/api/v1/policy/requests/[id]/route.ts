/** GET /api/v1/policy/requests/{id}: the status of a proposed policy change (pending, applied, rejected, stale). */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { noStore, policyKey } from "../../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const key = await policyKey(req, "GET /api/v1/policy/requests/{id}");
  if (!key.ok) return key.response;
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400, headers: noStore });
  try {
    const row = await prisma.policyChangeRequest.findFirst({ where: { id, organizationId: key.organizationId }, select: { id: true, status: true, loosens: true, decidedAt: true, createdAt: true } });
    if (!row) return NextResponse.json({ ok: false, error: "request_not_found" }, { status: 404, headers: noStore });
    return NextResponse.json({ ok: true, request: row }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "policy_requests_unavailable" }, { status: 503, headers: noStore });
  }
}
