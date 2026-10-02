/**
 * GitHub configuration helpers.
 *
 * Single source of truth for "what GitHub auth paths are configured?"
 * Mirrors the awsConfig / azureConfig / gcpConfig pattern. Consumers
 * (validator, live scanner, ReleaseOps state, security scanner) never
 * read process.env directly.
 *
 * Hard rules:
 *  - Never returns the App private key or PAT. Callers receive only
 *    presence booleans + non-sensitive identifiers (App ID, installation
 *    id, default org).
 *  - Never logs key material.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";

export type GithubMode = "live" | "preview" | "disabled";
export type GithubAuthPreference = "github_app" | "personal_access_token" | "oauth_only" | "none";

export interface GithubRuntimeConfig {
  /** Effective sync mode for GitHub on this deployment. */
  mode: GithubMode;
  /** Which auth path actually has all its env vars present today. */
  authPreference: GithubAuthPreference;
  /** True when GITHUB_APP_ID + GITHUB_PRIVATE_KEY are both present (App path). */
  appConfigured: boolean;
  /** Numeric App ID — non-sensitive. */
  appId?: number;
  /** Numeric installation id — non-sensitive. */
  installationId?: number;
  /** True when GITHUB_PAT is present (dev / preview path). */
  patConfigured: boolean;
  /** True when GITHUB_WEBHOOK_SECRET is configured. */
  webhookSecretConfigured: boolean;
  /** Default org / login for unauthenticated browses (UI hint only). */
  defaultOrg?: string;
}

/**
 * A GitHub App installation handoff needs the public App slug and the
 * server-only credentials required immediately after GitHub returns. Keeping
 * this decision in one place prevents a browser flow that cannot be validated.
 */
export function isGithubAppInstallationReady(
  config: Pick<GithubRuntimeConfig, "appConfigured">,
  appSlug: string | undefined,
): boolean {
  return config.appConfigured && Boolean(appSlug?.trim());
}

export function getGithubConfig(): GithubRuntimeConfig {
  const env = loadAppEnv();
  const e = process.env;

  const appIdRaw = e.GITHUB_APP_ID?.trim();
  const appId = appIdRaw && /^\d+$/.test(appIdRaw) ? Number(appIdRaw) : undefined;
  const installationIdRaw = e.GITHUB_INSTALLATION_ID?.trim();
  const installationId = installationIdRaw && /^\d+$/.test(installationIdRaw) ? Number(installationIdRaw) : undefined;

  const appConfigured = env.githubAppConfigured && Boolean(appId);
  const patConfigured = env.githubPatConfigured;

  let authPreference: GithubAuthPreference = "none";
  if (appConfigured) authPreference = "github_app";
  else if (patConfigured) authPreference = "personal_access_token";
  else if (env.oauth.github) authPreference = "oauth_only";

  let mode: GithubMode;
  if (env.githubSyncMode === "disabled") mode = "disabled";
  else if (env.githubSyncMode === "live" && (appConfigured || patConfigured)) mode = "live";
  else mode = "preview";

  return {
    mode,
    authPreference,
    appConfigured,
    appId,
    installationId,
    patConfigured,
    webhookSecretConfigured: Boolean(e.GITHUB_WEBHOOK_SECRET?.trim()),
    defaultOrg: env.githubDefaultOrg,
  };
}

/** Honest list of what's missing for live GitHub mode. Used by validators + UI hints. */
export function listMissingGithubConfig(): string[] {
  const cfg = getGithubConfig();
  if (cfg.mode === "live") return [];
  const missing: string[] = [];
  if (!cfg.appConfigured && !cfg.patConfigured) {
    missing.push("GITHUB_APP_ID + GITHUB_PRIVATE_KEY  *or*  GITHUB_PAT");
  }
  if (cfg.mode === "preview" && loadAppEnv().githubSyncMode !== "live") {
    missing.push("GITHUB_SYNC_MODE=live");
  }
  return missing;
}

/** Server-only resolver for the App private key. Never crosses the network. */
export function resolveGithubAppPrivateKey(): string | undefined {
  const raw = process.env.GITHUB_PRIVATE_KEY?.trim();
  if (!raw) return undefined;
  // Common env-var gotcha: literal `\n` in a single-line export. Restore real newlines.
  return raw.replace(/\\n/g, "\n");
}
