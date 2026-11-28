/**
 * POST /api/desktop/identity-providers/[id]/test { email } — starts a test sign-in for a pending or
 * active connection. Returns the identity provider URL to open in a browser. A passing test signs
 * no one in; it only records lastTestAssertionAt, which activation requires.
 */
import { NextResponse, type NextRequest } from "next/server";
import { startSignIn } from "@/lib/identity/oidc/tenantSsoService";
import { ssoRedirectUri, tenantSsoDeps } from "@/lib/identity/oidc/tenantSsoDeps";
import { ssoAdmin, unauthorized } from "@/lib/identity/oidc/adminRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await ssoAdmin(request, "POST /api/desktop/identity-providers/[id]/test");
  if (!admin) return unauthorized();
  const redirectUri = ssoRedirectUri();
  if (!redirectUri) return NextResponse.json({ ok: false, error: "sso_unavailable" }, { status: 503 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const r = await startSignIn(tenantSsoDeps(), { email: body?.email, callbackUrl: "/control/settings", redirectUri, mode: "test", testProviderId: id, testOrganizationId: admin.organizationId });
  return r.ok
    ? NextResponse.json({ ok: true, data: { redirectUrl: r.redirectUrl } }, { headers: { "Cache-Control": "private, no-store" } })
    : NextResponse.json({ ok: false, error: r.reason }, { status: 422 });
}
