/**
 * GET /api/audit/verify?organizationId=...
 * A workspace member re-verifies the audit seal chain (A11). Read-only.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { verifyOrganizationAudit } from "@/lib/audit/sealService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!await authorizedForOrganization(userId, organizationId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await verifyOrganizationAudit(organizationId as string)) }, { headers: { "Cache-Control": "no-store" } });
}
