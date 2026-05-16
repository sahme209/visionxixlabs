/**
 * GCP configuration helpers.
 *
 * Single source of truth for "is GCP live-capable on this deployment?"
 * Wraps the env loader so consumers (validator, scanner, capability
 * surfaces) never read process.env directly.
 *
 * Hard rules:
 *  - Never returns the private key or service account JSON. Callers
 *    receive only presence booleans.
 *  - Never logs the key material. Errors must redact before audit.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";

export type GcpMode = "live" | "preview" | "expanding" | "disabled";

export interface GcpRuntimeConfig {
  /** True when at least one credential path is fully configured:
   *  (PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY) or (PROJECT_ID + SERVICE_ACCOUNT_JSON). */
  credentialsConfigured: boolean;
  /** Effective mode for GCP on this deployment. */
  mode: GcpMode;
  /** Default project id from env (if set). */
  defaultProjectId?: string;
  /** Which credential format is configured on the host. */
  credentialFormat: "split_pem" | "json_blob" | "none";
}

export function getGcpConfig(): GcpRuntimeConfig {
  const env = loadAppEnv();
  const splitPem = Boolean(process.env.GCP_PRIVATE_KEY && process.env.GCP_CLIENT_EMAIL);
  const jsonBlob = Boolean(process.env.GCP_SERVICE_ACCOUNT_JSON);
  const credentialFormat: GcpRuntimeConfig["credentialFormat"] =
    splitPem ? "split_pem" : jsonBlob ? "json_blob" : "none";

  return {
    credentialsConfigured: env.gcpConfigured,
    mode: resolveMode(env.gcpScanMode, env.gcpConfigured, Boolean(env.gcpProjectId)),
    defaultProjectId: env.gcpProjectId,
    credentialFormat,
  };
}

function resolveMode(scanMode: "live" | "preview" | "disabled", configured: boolean, partial: boolean): GcpMode {
  if (scanMode === "disabled") return "disabled";
  if (scanMode === "live" && configured) return "live";
  if (partial) return "expanding";
  return "preview";
}

/** Resolve the GCP service account JSON if configured (server-only). */
export function resolveGcpServiceAccountJson(): string | undefined {
  return process.env.GCP_SERVICE_ACCOUNT_JSON?.trim() || undefined;
}

/** Resolve the GCP private key if configured (server-only). */
export function resolveGcpPrivateKey(): string | undefined {
  return process.env.GCP_PRIVATE_KEY?.trim() || undefined;
}

/** Resolve the GCP client email if configured. */
export function resolveGcpClientEmail(): string | undefined {
  return process.env.GCP_CLIENT_EMAIL?.trim() || undefined;
}
