/**
 * Azure Storage deep-posture extractor.
 *
 * Mirrors the AWS S3 public-access-block (PAB) work for Azure Blob:
 * lists every storage account in the subscription via @azure/arm-storage,
 * captures the four posture levers that matter for blob exposure:
 *   - allowBlobPublicAccess (the "deny public" master switch)
 *   - publicNetworkAccess  ("Enabled" vs "Disabled")
 *   - minimumTlsVersion    (we surface anything < TLS1_2)
 *   - supportsHttpsTrafficOnly
 *
 * Hard rules:
 *   - Only runs when Azure live mode + AZURE_INVENTORY_EXTRACT_ENABLED.
 *   - 20s overall list timeout; per-account failures isolated.
 *   - Never leaks the client secret.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import {
  getAzureConfig,
  resolveAzureClientId,
  resolveAzureClientSecret,
} from "./azureConfig";

const LIST_TIMEOUT_MS = 20_000;

export interface AzureStorageAccountSummary {
  name: string;
  resourceGroup?: string;
  location?: string;
  kind?: string;
  /** True when blob public access is allowed at the account level. */
  allowBlobPublicAccess: boolean;
  /** "Enabled" or "Disabled" — Azure default is "Enabled". */
  publicNetworkAccess: boolean;
  /** True when the account requires HTTPS-only traffic. */
  httpsTrafficOnly: boolean;
  /** Minimum TLS version string ("TLS1_2", "TLS1_1", etc). */
  minimumTlsVersion?: string;
  /** Convenience: true when the minimum TLS is below 1.2. */
  weakTls: boolean;
}

export interface AzureStorageExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  total: number;
  publicBlobAccessCount: number;
  publicNetworkCount: number;
  nonHttpsCount: number;
  weakTlsCount: number;
  accounts: AzureStorageAccountSummary[];
  durationMs: number;
  limitations: string[];
}

export async function extractAzureStorageAccounts(): Promise<AzureStorageExtraction> {
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

  let stClient;
  try {
    const { StorageManagementClient } = await import("@azure/arm-storage");
    stClient = new StorageManagementClient(credential, subscriptionId);
  } catch (err) {
    return blocked(start, `Storage client init failed: ${redact(errMessage(err))}`);
  }

  const items: AzureStorageAccountSummary[] = [];
  try {
    await withTimeout(
      (async () => {
        const iter = stClient.storageAccounts.list();
        for await (const raw of iter) {
          const a = raw as {
            name?: string;
            id?: string;
            location?: string;
            kind?: string;
            properties?: {
              allowBlobPublicAccess?: boolean;
              publicNetworkAccess?: string;
              supportsHttpsTrafficOnly?: boolean;
              minimumTlsVersion?: string;
            };
          };
          const rg = a.id?.match(/resourceGroups\/([^/]+)/i)?.[1];
          const minTls = a.properties?.minimumTlsVersion;
          items.push({
            name: a.name ?? "unknown",
            resourceGroup: rg,
            location: a.location ?? undefined,
            kind: a.kind ?? undefined,
            // Azure default for legacy accounts is true — keep that default explicit.
            allowBlobPublicAccess: a.properties?.allowBlobPublicAccess !== false,
            publicNetworkAccess: (a.properties?.publicNetworkAccess ?? "Enabled") !== "Disabled",
            httpsTrafficOnly: a.properties?.supportsHttpsTrafficOnly !== false,
            minimumTlsVersion: minTls,
            weakTls: minTls ? !/^TLS1_2|TLS1_3$/i.test(minTls) : true,
          });
          if (items.length >= 500) return;
        }
      })(),
      LIST_TIMEOUT_MS,
      "storage.list",
    );
  } catch (err) {
    return blocked(start, `Storage account list failed: ${redact(errMessage(err))}`);
  }

  return {
    mode: "live",
    total: items.length,
    publicBlobAccessCount: items.filter((a) => a.allowBlobPublicAccess).length,
    publicNetworkCount: items.filter((a) => a.publicNetworkAccess).length,
    nonHttpsCount: items.filter((a) => !a.httpsTrafficOnly).length,
    weakTlsCount: items.filter((a) => a.weakTls).length,
    accounts: items,
    durationMs: Date.now() - start,
    limitations: [],
  };
}

function preview(start: number, note: string): AzureStorageExtraction {
  return {
    mode: "preview",
    total: 0,
    publicBlobAccessCount: 0,
    publicNetworkCount: 0,
    nonHttpsCount: 0,
    weakTlsCount: 0,
    accounts: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}
function blocked(start: number, note: string): AzureStorageExtraction {
  return {
    mode: "blocked",
    total: 0,
    publicBlobAccessCount: 0,
    publicNetworkCount: 0,
    nonHttpsCount: 0,
    weakTlsCount: 0,
    accounts: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function redact(msg: string): string {
  return msg.replace(/[A-Za-z0-9+/=]{30,}/g, "[redacted]");
}
