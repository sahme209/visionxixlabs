import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_DESKTOP_ORIGINS = new Set([
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "http://localhost:1420",
  "http://localhost:5173",
]);

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' data: blob:; frame-ancestors 'self';",
  );
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");
  const desktopOrigin = origin && ALLOWED_DESKTOP_ORIGINS.has(origin) ? origin : null;

  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const preflight = new NextResponse(null, { status: 204 });
    if (desktopOrigin) {
      preflight.headers.set("Access-Control-Allow-Origin", desktopOrigin);
      preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      preflight.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
      preflight.headers.set("Access-Control-Max-Age", "86400");
      preflight.headers.set("Vary", "Origin");
    }
    return applySecurityHeaders(preflight);
  }

  // The downloadable app is the canonical operational product. Keep the
  // hosted API/control plane available to desktop clients, but do not expose
  // live cloud operations through browser pages.
  const isWebOperationsRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/operator" ||
    pathname.startsWith("/operator/");

  const isBrowserSignupPage = pathname === "/auth/signup";
  const isBrowserSigninPage = pathname === "/auth/signin";
  const requestedReturnPath =
    request.nextUrl.searchParams.get("callbackUrl") ??
    request.nextUrl.searchParams.get("redirect") ??
    "";
  const isApprovedBrowserAuthFlow =
    requestedReturnPath.startsWith("/desktop/") ||
    requestedReturnPath.startsWith("/accept-invite/") ||
    requestedReturnPath.startsWith("/admin/");

  // A callbackUrl/redirect value that resolves to a different origin than
  // this request is never a legitimate same-site return path — treat it
  // the same as any other unapproved browser operations access rather
  // than letting the sign-in page render and potentially honor it later.
  const isExternalReturnPath = (() => {
    if (!requestedReturnPath) return false;
    try {
      return new URL(requestedReturnPath, request.nextUrl.origin).origin !== request.nextUrl.origin;
    } catch {
      return false;
    }
  })();

  // A browser can authenticate an identity and open the lightweight web
  // companion. New account creation remains desktop-initiated so it is bound
  // to a short-lived device pairing challenge rather than becoming an
  // unrestricted signup API.
  if (
    isWebOperationsRoute ||
    (isBrowserSignupPage && !isApprovedBrowserAuthFlow) ||
    (isBrowserSigninPage && isExternalReturnPath)
  ) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/download";
    destination.search = "";
    destination.searchParams.set("from", pathname);
    return applySecurityHeaders(NextResponse.redirect(destination, 307));
  }

  const response = NextResponse.next();

  if (desktopOrigin && pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", desktopOrigin);
    response.headers.set("Vary", "Origin");
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
