/**
 * Azure configuration helpers.
 *
 * Single source of truth for "is Azure live-capable on this deployment?"
 * Wraps the env loader so consumers (validator, scanner, capability
 * surfaces) never read process.env directly.
 *
 * Hard rules:
 *  - Never returns the client secret. The secret stays inside the
 *    process boundary; callers receive only presence booleans.
 *  - Never logs the secret. Errors must use the redactor before being
 *    surfaced to audit.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";

export type AzureMode = "live" | "preview" | "expanding" | "disabled";

export interface AzureRuntimeConfig {
  /** True when AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_SUBSCRIPTION_ID are all set. */
  credentialsConfigured: boolean;
  /** Effective mode for Azure on this deployment. */
  mode: AzureMode;
  /** Default subscription id from env (if set). Never includes the secret. */
  defaultSubscriptionId?: string;
  /** Default tenant id from env (if set). */
  defaultTenantId?: string;
}

export function getAzureConfig(): AzureRuntimeConfig {
  const env = loadAppEnv();
  return {
    credentialsConfigured: env.azureConfigured,
    mode: resolveMode(env.azureScanMode, env.azureConfigured, Boolean(env.azureTenantId || env.azureSubscriptionId)),
    defaultSubscriptionId: env.azureSubscriptionId,
    defaultTenantId: env.azureTenantId,
  };
}

function resolveMode(scanMode: "live" | "preview" | "disabled", configured: boolean, partial: boolean): AzureMode {
  if (scanMode === "disabled") return "disabled";
  if (scanMode === "live" && configured) return "live";
  if (partial) return "expanding";
  return "preview";
}

/** Resolve the live-call client secret. Server-only. Never crosses the network. */
export function resolveAzureClientSecret(): string | undefined {
  return process.env.AZURE_CLIENT_SECRET?.trim() || undefined;
}

/** Resolve the live-call client id. */
export function resolveAzureClientId(): string | undefined {
  return process.env.AZURE_CLIENT_ID?.trim() || undefined;
}
