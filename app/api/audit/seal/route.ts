/**
 * POST /api/audit/seal  Body: { organizationId }
 * A workspace owner/admin seals all audit events since the last seal (A11).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { sealOrganizationAudit } from "@/lib/audit/sealService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const body = await req.json().catch(() => null) as { organizationId?: unknown } | null;
  if (!await authorizedForOrganization(userId, body?.organizationId, true)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const result = await sealOrganizationAudit(body!.organizationId as string);
  if (!result.ok) return NextResponse.json(result, { status: 409 });
  return NextResponse.json({ ok: true, sealed: result.sealed ? { sequence: result.sealed.sequence, eventCount: result.sealed.eventCount, sealHash: result.sealed.sealHash, toCreatedAt: result.sealed.toCreatedAt } : null }, { headers: { "Cache-Control": "no-store" } });
}
