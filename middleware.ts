import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
