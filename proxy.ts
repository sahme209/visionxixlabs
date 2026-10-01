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

  const isBrowserIdentityPage =
    pathname === "/auth/signin" ||
    pathname === "/auth/signup" ||
    pathname === "/auth/success";
  const requestedReturnPath =
    request.nextUrl.searchParams.get("callbackUrl") ??
    request.nextUrl.searchParams.get("redirect") ??
    "";
  const isApprovedBrowserAuthFlow =
    requestedReturnPath.startsWith("/desktop/") ||
    requestedReturnPath.startsWith("/accept-invite/") ||
    requestedReturnPath.startsWith("/admin/");

  // Authentication is initiated by Axiom Agent. A browser is only used to
  // complete its short-lived pairing request, then returns to the installed
  // app. Public navigation therefore goes to download rather than presenting
  // a second, incomplete browser workspace.
  if (isWebOperationsRoute || (isBrowserIdentityPage && !isApprovedBrowserAuthFlow)) {
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
