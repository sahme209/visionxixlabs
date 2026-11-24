import type { NextRequest } from "next/server";

/**
 * Browser-only account mutations must come from this Axiom origin. Session
 * authorization remains the primary boundary; this is a defense-in-depth
 * check against cross-site form or fetch requests carrying a user session.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin === request.nextUrl.origin) return true;

  // Next normalizes numeric loopback hosts to localhost in NextURL. Preserve
  // the actual browser origin only when it matches the configured local app.
  if (!origin || request.nextUrl.hostname !== "localhost" || !process.env.NEXTAUTH_URL) return false;
  try {
    const configured = new URL(process.env.NEXTAUTH_URL);
    return ["127.0.0.1", "[::1]"].includes(configured.hostname)
      && configured.protocol === request.nextUrl.protocol && configured.port === request.nextUrl.port
      && origin === configured.origin && request.headers.get("host") === configured.host;
  } catch {
    return false;
  }
}
