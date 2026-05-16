/**
 * Canonical provider/feature mode resolvers.
 *
 * Every page that needs to know "is AWS live or preview?" / "is Azure
 * expanding or disabled?" calls a function from here — not its own env
 * read. One source of truth.
 *
 * Server-only: imports `loadAppEnv` which is server-only.
 */

import "server-only";
import { loadAppEnv } from "./env";

export type ProviderMode = "live" | "preview" | "expanding" | "disabled";

export type CloudProvider = "aws" | "azure" | "gcp";
export type ConnectorKind = "github" | "github_app" | "gitlab" | "azure_devops" | "jenkins" | "argocd";

// ---------------------------------------------------------------------------
// Cloud providers
// ---------------------------------------------------------------------------

export function getCloudProviderMode(provider: CloudProvider): ProviderMode {
  const env = loadAppEnv();
  switch (provider) {
    case "aws":
      // Live requires explicit AWS_SCAN_MODE=live AND broker creds present.
      if (env.awsScanMode === "disabled") return "disabled";
      if (env.awsScanMode === "live" && env.awsBrokerConfigured) return "live";
      return "preview";
    case "azure":
      // Live requires AZURE_SCAN_MODE=live AND tenant+client+secret+subscription set.
      if (env.azureScanMode === "disabled") return "disabled";
      if (env.azureScanMode === "live" && env.azureConfigured) return "live";
      // Expanding when at least some config is present but live mode isn't activated.
      if (env.azureTenantId || env.azureSubscriptionId) return "expanding";
      return "preview";
    case "gcp":
      // Live requires GCP_SCAN_MODE=live AND either (PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY)
      // or (PROJECT_ID + SERVICE_ACCOUNT_JSON).
      if (env.gcpScanMode === "disabled") return "disabled";
      if (env.gcpScanMode === "live" && env.gcpConfigured) return "live";
      if (env.gcpProjectId) return "expanding";
      return "preview";
  }
}

// ---------------------------------------------------------------------------
// Connectors (GitHub etc.)
// ---------------------------------------------------------------------------

export function getConnectorMode(connector: ConnectorKind): ProviderMode {
  const env = loadAppEnv();
  switch (connector) {
    case "github":
    case "github_app":
      // Live requires sync mode = live AND at least one credential path:
      // - GITHUB_PAT (personal access token — practical / dev path), or
      // - GITHUB_APP_ID + GITHUB_PRIVATE_KEY (production path), or
      // - OAuth client (legacy — only useful for sign-in, not live reads).
      if (env.githubSyncMode === "disabled") return "disabled";
      if (env.githubSyncMode === "live" && (env.githubPatConfigured || env.githubAppConfigured)) {
        return "live";
      }
      return "preview";
    case "gitlab":
    case "azure_devops":
    case "jenkins":
    case "argocd":
      // No live integration shipped yet.
      return "expanding";
  }
}

/**
 * Which GitHub auth path is actually usable right now. Pages can call this
 * to render honest connection-state UI.
 */
export type GithubAuthPath = "github_app" | "personal_access_token" | "oauth_only" | "none";

export function getGithubAuthPath(): GithubAuthPath {
  const env = loadAppEnv();
  if (env.githubAppConfigured) return "github_app";
  if (env.githubPatConfigured) return "personal_access_token";
  if (env.oauth.github) return "oauth_only";
  return "none";
}

// ---------------------------------------------------------------------------
// Desktop + security scanner + ReleaseOps
// ---------------------------------------------------------------------------

export type DesktopAvailability = "available" | "preview" | "planned" | "disabled";

export function getDesktopAvailability(): DesktopAvailability {
  const env = loadAppEnv();
  if (env.desktopMode === "disabled") return "disabled";
  if (env.desktopMode === "live" && env.desktopDownloadsEnabled) return "available";
  if (env.desktopMode === "live") return "preview"; // mode set live but no signed binaries yet
  return "preview";
}

export type SecurityScannerMode = "live" | "preview" | "disabled";

export function getSecurityScannerMode(): SecurityScannerMode {
  // The security scanner engine is real (typed checks). Live mode would
  // mean continuous scheduled scans; preview means on-demand only.
  // Until a scheduler ships, default to preview.
  return "preview";
}

export function getReleaseOpsMode(): ProviderMode {
  return getConnectorMode("github");
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const MODE_LABEL: Record<ProviderMode, string> = {
  live:      "Live",
  preview:   "Preview",
  expanding: "Expanding",
  disabled:  "Disabled",
};

export function modeSemantic(mode: ProviderMode): "success" | "warning" | "neutral" {
  if (mode === "live") return "success";
  if (mode === "preview" || mode === "expanding") return "warning";
  return "neutral";
}
