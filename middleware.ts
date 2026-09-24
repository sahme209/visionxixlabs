import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");
  const allowedDesktopOrigins = new Set([
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://localhost:5173",
  ]);
  const desktopOrigin = origin && allowedDesktopOrigins.has(origin) ? origin : null;

  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const preflight = new NextResponse(null, { status: 204 });
    if (desktopOrigin) {
      preflight.headers.set("Access-Control-Allow-Origin", desktopOrigin);
      preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      preflight.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
      preflight.headers.set("Access-Control-Max-Age", "86400");
      preflight.headers.set("Vary", "Origin");
    }
    return preflight;
  }

  // TAURI is delivered as a web application. Historical marketing routes
  // contained desktop-first, autonomous-operation, and fabricated social-
  // proof claims. Keep old inbound links working by routing them to the
  // audited canonical sections instead of serving stale claims.
  const canonicalMarketingRoute: Record<string, string> = {
    "/axiom": "/#capabilities",
    "/axiom/releaseops": "/#workflow",
    "/capabilities": "/#capabilities",
    "/compare": "/#capabilities",
    "/disciplines": "/#capabilities",
    "/faq": "/#capabilities",
    "/how-it-works": "/#workflow",
    "/integrations": "/#integrations",
    "/platforms": "/download",
    "/team-of-one": "/#capabilities",
    "/trust": "/#capabilities",
    "/case-studies": "/#capabilities",
    "/changelog": "/docs",
    "/press": "/",
    "/insights": "/docs",
    "/status": "/",
    "/services": "/#capabilities",
    "/blog": "/docs",
    "/cloud-security": "/#capabilities",
    "/cloud-solutions": "/#capabilities",
    "/design": "/",
    "/enterprise-readiness": "/#capabilities",
    "/handbook": "/docs",
    "/manifesto": "/",
    "/operator": "/download",
    "/pricing": "/plans",
    "/principles": "/",
    "/security": "/#capabilities",
    "/team": "/",
    "/docs/desktop-install": "/download",
    "/docs/desktop-architecture": "/download",
  };

  const canonical = canonicalMarketingRoute[pathname];
  if (canonical) {
    return NextResponse.redirect(new URL(canonical, request.url), 308);
  }

  if (pathname.startsWith("/blog/") || pathname.startsWith("/case-studies/") || pathname.startsWith("/docs/") || pathname.startsWith("/insights/")) {
    return NextResponse.redirect(new URL("/docs", request.url), 308);
  }

  if (pathname.startsWith("/axiom/") || pathname.startsWith("/cloud-solutions/")) {
    return NextResponse.redirect(new URL("/#capabilities", request.url), 308);
  }

  if (pathname.startsWith("/desktop/") || pathname.startsWith("/download/") || pathname.startsWith("/operator/")) {
    return NextResponse.redirect(new URL("/download", request.url), 308);
  }

  const response = NextResponse.next();

  if (desktopOrigin && pathname.startsWith("/api/")) {
    response.headers.set("Access-Control-Allow-Origin", desktopOrigin);
    response.headers.set("Vary", "Origin");
  }

  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' data: blob:; frame-ancestors 'self';"
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
