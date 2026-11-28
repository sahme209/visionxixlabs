/** POST /api/desktop/identity-providers/[id]/verify-domains — checks each managed domain's _v19-verification TXT record. */
import { NextResponse, type NextRequest } from "next/server";
import { resolveTxt } from "node:dns/promises";
import { prisma } from "@/lib/db";
import { verifyDomains, type AdminDb } from "@/lib/identity/oidc/tenantSsoAdmin";
import { ssoAdmin, ssoAudit, unauthorized } from "@/lib/identity/oidc/adminRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await ssoAdmin(request, "POST /api/desktop/identity-providers/[id]/verify-domains");
  if (!admin) return unauthorized();
  const { id } = await params;
  const r = await verifyDomains(prisma as unknown as AdminDb, resolveTxt, { organizationId: admin.organizationId, id });
  if (r.status === 200) await ssoAudit(admin.organizationId, admin.userId, id, "identity.sso_domains_checked", "Checked company sign-in domain records");
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "private, no-store" } });
}
