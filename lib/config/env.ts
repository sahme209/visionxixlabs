/**
 * Canonical server-side env loader.
 *
 * Validates required env vars at first access + exposes typed accessors.
 * Server-only — never import from a client component. Client-safe feature
 * status comes from `lib/config/features.ts` (which is safe to import
 * anywhere — it reads booleans from the server-side answer via the
 * /api/config/features endpoint when needed).
 *
 * Rules encoded:
 *  - Required vars throw a clear error when missing.
 *  - Optional vars resolve to `undefined`; callers decide fallback.
 *  - Mode toggles (live / preview / disabled) are typed enums.
 *  - "NEXT_PUBLIC_*" keys are not accepted here — those belong to the
 *    client-safe surface.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeatureMode = "live" | "preview" | "disabled";

export interface AppEnv {
  /** Public app URL (e.g. https://visionxixlabs.com). Used for absolute links. */
  appUrl: string;
  /** NextAuth secret. Required for any auth flow. */
  nextAuthSecret?: string;
  /** Public origin NextAuth uses to build callback URLs. */
  nextAuthUrl?: string;
  /** Database URL — Prisma reads this directly; we expose for diagnostics. */
  databaseUrlSet: boolean;
  /** AI provider key presence — never the value. */
  aiProviders: { openai: boolean; anthropic: boolean; gemini: boolean };
  /** OAuth provider env presence. */
  oauth: { google: boolean; github: boolean };
  /** AWS broker credentials presence (server-only — we don't expose the value). */
  awsBrokerConfigured: boolean;
  /** AWS scan mode — drives the scanner branch. */
  awsScanMode: FeatureMode;
  /** GitHub sync mode. */
  githubSyncMode: FeatureMode;
  /** Desktop runtime mode. */
  desktopMode: FeatureMode;
  /** Desktop downloads — false unless real signed binaries are present. */
  desktopDownloadsEnabled: boolean;
  /** Desktop handoff signing key presence. */
  desktopHandoffSigningKeySet: boolean;
  /** Optional dedicated audit signing key — falls back to NEXTAUTH_SECRET if unset. */
  auditSigningKeySet: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return fallback;
}

function mode(value: string | undefined, fallback: FeatureMode): FeatureMode {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "live" || v === "preview" || v === "disabled") return v;
  return fallback;
}

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Loader (memoised — env doesn't change at runtime)
// ---------------------------------------------------------------------------

let _cached: AppEnv | null = null;

export function loadAppEnv(): AppEnv {
  if (_cached) return _cached;
  const env = process.env;

  const appUrl =
    env.APP_URL?.trim() ||
    env.NEXTAUTH_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  _cached = {
    appUrl,
    nextAuthSecret: env.NEXTAUTH_SECRET?.trim(),
    nextAuthUrl: env.NEXTAUTH_URL?.trim(),
    databaseUrlSet: isSet(env.DATABASE_URL),
    aiProviders: {
      openai:    isSet(env.OPENAI_API_KEY),
      anthropic: isSet(env.ANTHROPIC_API_KEY),
      gemini:    isSet(env.GEMINI_API_KEY),
    },
    oauth: {
      google: isSet(env.GOOGLE_CLIENT_ID) && isSet(env.GOOGLE_CLIENT_SECRET),
      github: isSet(env.GITHUB_CLIENT_ID) && isSet(env.GITHUB_CLIENT_SECRET),
    },
    awsBrokerConfigured:
      isSet(env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID) &&
      isSet(env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY),
    awsScanMode: mode(
      env.AWS_SCAN_MODE,
      isSet(env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID) ? "live" : "preview",
    ),
    githubSyncMode: mode(
      env.GITHUB_SYNC_MODE,
      isSet(env.GITHUB_CLIENT_ID) ? "preview" : "preview",
    ),
    desktopMode: mode(env.DESKTOP_MODE, "preview"),
    desktopDownloadsEnabled: bool(env.DESKTOP_DOWNLOADS_ENABLED, false),
    desktopHandoffSigningKeySet: isSet(env.DESKTOP_HANDOFF_SIGNING_KEY),
    auditSigningKeySet: isSet(env.AUDIT_SIGNING_KEY),
  };
  return _cached;
}

/** Force a reload — test seam. */
export function __resetEnvCacheForTest(): void { _cached = null; }

// ---------------------------------------------------------------------------
// Required-var assertions
// ---------------------------------------------------------------------------

export function assertCoreEnv(): void {
  const env = loadAppEnv();
  const missing: string[] = [];
  if (!env.nextAuthSecret) missing.push("NEXTAUTH_SECRET");
  if (!env.databaseUrlSet) missing.push("DATABASE_URL");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}.`);
  }
}
