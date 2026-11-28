/**
 * GET /api/sso/oidc/callback?code&state  (the redirect URI companies register)
 * Verifies the sign-in and hands the browser a one-time ticket in the URL fragment (never sent to
 * servers or logs); /auth/sso/complete exchanges it for a normal session. An admin test returns
 * to Settings instead and signs no one in.
 */
import { NextResponse, type NextRequest } from "next/server";
import { completeCallback } from "@/lib/identity/oidc/tenantSsoService";
import { ssoRedirectUri, tenantSsoDeps } from "@/lib/identity/oidc/tenantSsoDeps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin, p = request.nextUrl.searchParams;
  const noStore = (res: NextResponse) => { res.headers.set("Cache-Control", "private, no-store"); res.headers.set("Referrer-Policy", "no-referrer"); return res; };
  const redirectUri = ssoRedirectUri();
  if (!redirectUri) return noStore(NextResponse.redirect(new URL("/auth/sso?error=sso.unavailable", origin), 303));
  let r;
  try { r = await completeCallback(tenantSsoDeps(), { state: p.get("state"), code: p.get("code"), error: p.get("error"), redirectUri }); }
  catch { r = { ok: false as const, reason: "sso.unavailable" }; }
  if (!r.ok) return noStore(NextResponse.redirect(new URL(`/auth/sso?error=${encodeURIComponent(r.reason)}`, origin), 303));
  if (r.kind === "test_passed") return noStore(NextResponse.redirect(new URL("/auth/sso?test=passed", origin), 303));
  const dest = new URL("/auth/sso/complete", origin);
  dest.hash = new URLSearchParams({ ticket: r.ticket, callbackUrl: r.callbackUrl }).toString();
  return noStore(NextResponse.redirect(dest, 303));
}
