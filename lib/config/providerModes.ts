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
      // Azure has typed adapters + validators in place but no live SDK wiring yet.
      return "expanding";
    case "gcp":
      // Same as Azure — adapter + validator foundation ready.
      return "expanding";
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
      // Live requires OAuth env present + sync mode flipped on.
      if (env.githubSyncMode === "disabled") return "disabled";
      if (env.githubSyncMode === "live" && env.oauth.github) return "live";
      return "preview";
    case "gitlab":
    case "azure_devops":
    case "jenkins":
    case "argocd":
      // No live integration shipped yet.
      return "expanding";
  }
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
