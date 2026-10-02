/**
 * Canonical feature-flag surface.
 *
 * Two flavours:
 *   - `serverFeatures()` — runs server-side, reads from env, returns full
 *     typed answer. Use in API routes, server components, server actions.
 *   - `FeatureFlags` (DTO) — what the client sees. Returned by the
 *     /api/config/features route and rendered into the page so client
 *     components can branch without each one re-fetching.
 *
 * The legacy `lib/featureFlags.ts` is kept for back-compat (existing
 * imports continue to work). New code should read from here.
 */

import "server-only";
import { loadAppEnv } from "./env";
import type { FeatureMode } from "./env";

export interface ServerFeatures {
  awsLiveScan: boolean;
  awsPreviewScan: boolean;
  githubLiveSync: boolean;
  githubPreviewSync: boolean;
  desktopApp: FeatureMode;
  desktopDownloads: boolean;
  releaseOps: FeatureMode;
  executionPlans: boolean;
  terraformExport: boolean;
  copilot: boolean;
  trustCenter: boolean;
  oauth: { google: boolean; github: boolean };
}

export interface FeatureFlags {
  /** Honest mode for AWS scans. */
  awsScanMode: FeatureMode;
  /** Honest mode for GitHub sync. */
  githubSyncMode: FeatureMode;
  /** Honest mode for the desktop app. */
  desktopMode: FeatureMode;
  /** Whether desktop binaries are actually distributable. */
  desktopDownloadsEnabled: boolean;
  /** Whether the copilot can call out to an LLM provider. */
  copilotEnabled: boolean;
  /** Whether the Trust Center is reachable. */
  trustCenterEnabled: boolean;
  /** Whether OAuth Google + GitHub are registered server-side. */
  oauth: { google: boolean; github: boolean };
}

// ---------------------------------------------------------------------------
// Server reader
// ---------------------------------------------------------------------------

export function serverFeatures(): ServerFeatures {
  const env = loadAppEnv();
  return {
    awsLiveScan:        env.awsScanMode === "live" && env.awsBrokerConfigured,
    awsPreviewScan:     env.awsScanMode === "preview" || (env.awsScanMode === "live" && !env.awsBrokerConfigured),
    githubLiveSync:     env.githubSyncMode === "live" && env.oauth.github,
    githubPreviewSync:  env.githubSyncMode === "preview" || env.githubSyncMode === "live",
    desktopApp:         env.desktopMode,
    desktopDownloads:   env.desktopDownloadsEnabled,
    releaseOps:         env.githubSyncMode,
    executionPlans:     true, // always available as preview
    terraformExport:    true, // always available — exports are local artifacts
    copilot:            env.aiProviders.openai || env.aiProviders.anthropic || env.aiProviders.gemini || env.aiProviders.xai,
    trustCenter:        true,
    oauth:              env.oauth,
  };
}

/** Build the client-safe DTO from the full server features. Never includes
 *  any secret or surface that would let the client deduce one. */
export function toClientFlags(s: ServerFeatures): FeatureFlags {
  return {
    awsScanMode:        s.awsLiveScan ? "live" : s.awsPreviewScan ? "preview" : "disabled",
    githubSyncMode:     s.githubLiveSync ? "live" : s.githubPreviewSync ? "preview" : "disabled",
    desktopMode:        s.desktopApp,
    desktopDownloadsEnabled: s.desktopDownloads,
    copilotEnabled:     s.copilot,
    trustCenterEnabled: s.trustCenter,
    oauth:              s.oauth,
  };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function featureLabel(mode: FeatureMode): string {
  switch (mode) {
    case "live":     return "Live";
    case "preview":  return "Preview";
    case "disabled": return "Disabled";
  }
}

export function featureSemantic(mode: FeatureMode): "success" | "warning" | "neutral" {
  switch (mode) {
    case "live":     return "success";
    case "preview":  return "warning";
    case "disabled": return "neutral";
  }
}
