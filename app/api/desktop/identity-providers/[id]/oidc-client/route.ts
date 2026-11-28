/** PUT /api/desktop/identity-providers/[id]/oidc-client { clientId, clientSecret } — stores the OIDC client; the secret is encrypted and never returned. */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { setOidcClient, type AdminDb } from "@/lib/identity/oidc/tenantSsoAdmin";
import { ssoAdmin, ssoAudit, unauthorized } from "@/lib/identity/oidc/adminRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await ssoAdmin(request, "PUT /api/desktop/identity-providers/[id]/oidc-client");
  if (!admin) return unauthorized();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { clientId?: unknown; clientSecret?: unknown } | null;
  const r = await setOidcClient(prisma as unknown as AdminDb, { encrypt: encryptScopedCredential }, { organizationId: admin.organizationId, id, clientId: body?.clientId, clientSecret: body?.clientSecret });
  if (r.status === 200) await ssoAudit(admin.organizationId, admin.userId, id, "identity.sso_client_configured", "Set the OIDC client for company sign-in");
  return NextResponse.json(r.body, { status: r.status, headers: { "Cache-Control": "private, no-store" } });
}
