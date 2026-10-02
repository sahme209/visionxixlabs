import "server-only";

import { loadAppEnv } from "@/lib/config/env";

const CALLBACK_PATHS = new Set([
  "/api/integrations/github/install-callback",
  "/api/integrations/slack/callback",
  "/api/integrations/teams/callback",
]);

/**
 * Builds a provider callback from Axiom's configured origin, never from an
 * inbound Host header. Production callbacks must use HTTPS; local development
 * may use HTTP only on loopback.
 */
export function trustedIntegrationCallbackUrl(path: string): string | null {
  if (!CALLBACK_PATHS.has(path)) return null;
  try {
    const configured = new URL(loadAppEnv().appUrl);
    const loopback = configured.hostname === "localhost" || configured.hostname === "127.0.0.1" || configured.hostname === "::1";
    if (configured.protocol !== "https:" && !loopback) return null;
    return new URL(path, configured.origin).toString();
  } catch {
    return null;
  }
}
