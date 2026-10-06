import type { NextRequest } from "next/server";

/**
 * Browser-only account mutations must come from this Axiom origin. Session
 * authorization remains the primary boundary; this is a defense-in-depth
 * check against cross-site form or fetch requests carrying a user session.
 */
export function isSameOriginRequest(request: NextRequest): boolean {
  return request.headers.get("origin") === request.nextUrl.origin;
}
