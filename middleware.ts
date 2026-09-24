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

  // The downloadable app is the canonical operational product. Keep the
  // hosted API/control plane available to desktop clients, but do not expose
  // live cloud operations through browser pages.
  const isWebOperationsRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/operator" ||
    pathname.startsWith("/operator/");

  if (isWebOperationsRoute) {
    const destination = request.nextUrl.clone();
    destination.pathname = "/download";
    destination.search = "";
    destination.searchParams.set("from", pathname);
    return NextResponse.redirect(destination, 307);
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
