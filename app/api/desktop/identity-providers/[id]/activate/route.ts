/** POST /api/desktop/identity-providers/[id]/activate — needs the OIDC client, every domain verified and a test sign-in from the last 24 hours. */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { activate, type AdminDb } from "@/lib/identity/oidc/tenantSsoAdmin";
import { ssoAdmin, ssoAudit, unauthorized } from "@/lib/identity/oidc/adminRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await ssoAdmin(request, "POST /api/desktop/identity-providers/[id]/activate");
  if (!admin) return unauthorized();
  const { id } = await params;
  const r = await activate(prisma as unknown as AdminDb, { organizationId: admin.organizationId, id, now: new Date() });
  if (r.status === 200) await ssoAudit(admin.organizationId, admin.userId, id, "identity.sso_activated", "Activated company sign-in");
  return NextResponse.json(r.body, { status: r.status });
}
