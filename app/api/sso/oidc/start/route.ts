/**
 * POST /api/sso/oidc/start  (form: email, callbackUrl)
 * Routes the email's domain to the company's identity provider and redirects there (303).
 * On any refusal, returns to /auth/sso with a reason code; never says which companies exist.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { checkRateLimit } from "@/lib/rateLimit";
import { startSignIn } from "@/lib/identity/oidc/tenantSsoService";
import { ssoRedirectUri, tenantSsoDeps } from "@/lib/identity/oidc/tenantSsoDeps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const back = (reason: string) => NextResponse.redirect(new URL(`/auth/sso?error=${encodeURIComponent(reason)}`, request.nextUrl.origin), 303);
  if (!isSameOriginRequest(request)) return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  const redirectUri = ssoRedirectUri();
  if (!redirectUri) return back("sso.unavailable");
  const form = await request.formData().catch(() => null);
  const email = form?.get("email"), callbackUrl = form?.get("callbackUrl");
  if (!checkRateLimit(`sso-start:${typeof email === "string" ? email.trim().toLowerCase() : "invalid"}`)) return back("sso.rate_limited");
  try {
    const r = await startSignIn(tenantSsoDeps(), { email, callbackUrl, redirectUri, mode: "signin" });
    return r.ok ? NextResponse.redirect(r.redirectUrl, 303) : back(r.reason === "sso.email_invalid" ? r.reason : "sso.no_provider_for_domain");
  } catch {
    return back("sso.unavailable");
  }
}
