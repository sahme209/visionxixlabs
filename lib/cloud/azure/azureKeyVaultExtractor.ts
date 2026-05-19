/**
 * Azure Key Vault inventory extractor.
 *
 * Lists every Key Vault in the subscription via @azure/arm-keyvault.
 * Per-vault detection: soft-delete enabled, purge protection,
 * RBAC vs access policy authorization, public network access.
 *
 * Hard rules:
 *   - Only runs when Azure live mode + AZURE_INVENTORY_EXTRACT_ENABLED.
 *   - 10s per call.
 *   - Per-vault failures isolated.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAzureConfig, resolveAzureClientId, resolveAzureClientSecret } from "./azureConfig";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface AzureKeyVaultSummary {
  name: string;
  resourceGroup?: string;
  location?: string;
  /** True when soft-delete is enabled (90-day recovery). */
  softDeleteEnabled: boolean;
  /** True when purge protection is enabled (prevents permanent delete). */
  purgeProtectionEnabled: boolean;
  /** True when RBAC authorization is used (vs legacy access policies). */
  rbacAuthorization: boolean;
  /** True when public network access is allowed. */
  publicNetworkAccess: boolean;
}

export interface AzureKeyVaultExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  total: number;
  noSoftDeleteCount: number;
  noPurgeProtectionCount: number;
  publicAccessCount: number;
  vaults: AzureKeyVaultSummary[];
  durationMs: number;
  limitations: string[];
}

export async function extractAzureKeyVaults(): Promise<AzureKeyVaultExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.azureInventoryExtractEnabled) {
    return blocked(start, "AZURE_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getAzureConfig();
  if (cfg.mode !== "live") {
    return preview(start, "Azure mode is not live — extractor returned honest preview.");
  }
  const tenantId = env.azureTenantId;
  const subscriptionId = env.azureSubscriptionId;
  if (!tenantId || !subscriptionId) {
    return blocked(start, "AZURE_TENANT_ID + AZURE_SUBSCRIPTION_ID required.");
  }
  const clientId = resolveAzureClientId();
  const clientSecret = resolveAzureClientSecret();
  if (!clientId || !clientSecret) {
    return blocked(start, "AZURE_CLIENT_ID + AZURE_CLIENT_SECRET required.");
  }

  let credential;
  try {
    const { ClientSecretCredential } = await import("@azure/identity");
    credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  } catch (err) {
    return blocked(start, `Azure credential init failed: ${redact(errMessage(err))}`);
  }

  let kvClient;
  try {
    const { KeyVaultManagementClient } = await import("@azure/arm-keyvault");
    kvClient = new KeyVaultManagementClient(credential, subscriptionId);
  } catch (err) {
    return blocked(start, `KeyVault client init failed: ${redact(errMessage(err))}`);
  }

  const items: AzureKeyVaultSummary[] = [];
  try {
    await withTimeout((async () => {
      const iter = kvClient.vaults.listBySubscription();
      for await (const raw of iter) {
        const v = raw as {
          name?: string;
          id?: string;
          location?: string;
          properties?: {
            enableSoftDelete?: boolean;
            enablePurgeProtection?: boolean;
            enableRbacAuthorization?: boolean;
            publicNetworkAccess?: string;
          };
        };
        const rg = v.id?.match(/resourceGroups\/([^/]+)/)?.[1];
        items.push({
          name: v.name ?? "unknown",
          resourceGroup: rg,
          location: v.location ?? undefined,
          softDeleteEnabled: v.properties?.enableSoftDelete !== false, // default true
          purgeProtectionEnabled: !!v.properties?.enablePurgeProtection,
          rbacAuthorization: !!v.properties?.enableRbacAuthorization,
          publicNetworkAccess: (v.properties?.publicNetworkAccess ?? "Enabled") !== "Disabled",
        });
        if (items.length >= 200) return;
      }
    })(), DEFAULT_TIMEOUT_MS * 2, "keyvault.list");
  } catch (err) {
    return blocked(start, `Key Vault list failed: ${redact(errMessage(err))}`);
  }

  return {
    mode: "live",
    total: items.length,
    noSoftDeleteCount: items.filter((v) => !v.softDeleteEnabled).length,
    noPurgeProtectionCount: items.filter((v) => !v.purgeProtectionEnabled).length,
    publicAccessCount: items.filter((v) => v.publicNetworkAccess).length,
    vaults: items,
    durationMs: Date.now() - start,
    limitations: [],
  };
}

function preview(start: number, note: string): AzureKeyVaultExtraction {
  return { mode: "preview", total: 0, noSoftDeleteCount: 0, noPurgeProtectionCount: 0, publicAccessCount: 0, vaults: [], durationMs: Date.now() - start, limitations: [note] };
}
function blocked(start: number, note: string): AzureKeyVaultExtraction {
  return { mode: "blocked", total: 0, noSoftDeleteCount: 0, noPurgeProtectionCount: 0, publicAccessCount: 0, vaults: [], durationMs: Date.now() - start, limitations: [note] };
}
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function redact(msg: string): string {
  return msg.replace(/[A-Za-z0-9+/=]{30,}/g, "[redacted]");
}
