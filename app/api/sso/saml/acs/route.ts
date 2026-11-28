/**
 * POST /api/sso/saml/acs  (form: SAMLResponse, RelayState) — the Assertion Consumer Service URL.
 * Only answers to an AuthnRequest V19 sent for a live sign-in attempt are accepted; IdP-initiated
 * (unsolicited) responses are refused. Success hands off a one-time ticket exactly like OIDC.
 */
import { NextResponse, type NextRequest } from "next/server";
import { completeSamlResponse } from "@/lib/identity/oidc/tenantSsoService";
import { ssoOrigin, tenantSsoDeps } from "@/lib/identity/oidc/tenantSsoDeps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = ssoOrigin();
  const noStore = (res: NextResponse) => { res.headers.set("Cache-Control", "private, no-store"); res.headers.set("Referrer-Policy", "no-referrer"); return res; };
  const go = (path: string, hash?: string) => { const u = new URL(path, origin ?? request.nextUrl.origin); if (hash) u.hash = hash; return noStore(NextResponse.redirect(u, 303)); };
  if (!origin) return go("/auth/sso?error=sso.unavailable");
  const form = await request.formData().catch(() => null);
  let r;
  try { r = await completeSamlResponse(tenantSsoDeps(), { relayState: form?.get("RelayState"), samlResponse: form?.get("SAMLResponse"), origin }); }
  catch { r = { ok: false as const, reason: "sso.unavailable" }; }
  if (!r.ok) return go(`/auth/sso?error=${encodeURIComponent(r.reason)}`);
  if (r.kind === "test_passed") return go("/auth/sso?test=passed");
  return go("/auth/sso/complete", new URLSearchParams({ ticket: r.ticket, callbackUrl: r.callbackUrl }).toString());
}
