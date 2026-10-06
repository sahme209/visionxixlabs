import "server-only";

import { loadAppEnv } from "@/lib/config/env";

const CALLBACK_PATHS = new Set([
  "/api/integrations/github/install-callback",
  "/api/integrations/slack/callback",
  "/api/integrations/teams/callback",
]);

function configuredAxiomOrigin(appUrl: string): URL | null {
  try {
    const configured = new URL(appUrl);
    const loopback = configured.hostname === "localhost" || configured.hostname === "127.0.0.1" || configured.hostname === "::1";
    if (configured.protocol !== "https:" && !loopback) return null;
    return configured;
  } catch {
    return null;
  }
}

/**
 * Builds an internal browser destination from the configured Axiom origin.
 * It deliberately refuses absolute and protocol-relative paths, so callback
 * returns cannot be redirected by an inbound Host header or query value.
 */
export function trustedAxiomUrlFromAppUrl(path: string, appUrl: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  const configured = configuredAxiomOrigin(appUrl);
  if (!configured) return null;
  const destination = new URL(path, configured.origin);
  return destination.origin === configured.origin ? destination.toString() : null;
}

export function trustedAxiomUrl(path: string): string | null {
  return trustedAxiomUrlFromAppUrl(path, loadAppEnv().appUrl);
}

/**
 * Builds a provider callback from Axiom's configured origin, never from an
 * inbound Host header. Production callbacks must use HTTPS; local development
 * may use HTTP only on loopback.
 */
export function trustedIntegrationCallbackUrl(path: string): string | null {
  return trustedIntegrationCallbackUrlFromAppUrl(path, loadAppEnv().appUrl);
}

/** Pure variant for callback-contract tests and server-side comparisons. */
export function trustedIntegrationCallbackUrlFromAppUrl(path: string, appUrl: string): string | null {
  if (!CALLBACK_PATHS.has(path)) return null;
  return trustedAxiomUrlFromAppUrl(path, appUrl);
}

/**
 * The OAuth code exchange must use the callback that Axiom currently trusts,
 * not merely a URI stored with an earlier authorization attempt. This keeps a
 * database mutation or stale configuration from steering the exchange away
 * from Axiom's configured callback origin.
 */
export function matchesTrustedIntegrationCallbackUrl(path: string, candidate: string): boolean {
  const expected = trustedIntegrationCallbackUrl(path);
  return expected !== null && expected === candidate;
}
