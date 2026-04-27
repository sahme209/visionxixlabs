/**
 * Azure Infrastructure Discovery — read-only inventory.
 * Uses Azure SDK: Compute, Storage, Resource Groups.
 * Collects counts and service summaries.
 */

import { ComputeManagementClient } from "@azure/arm-compute";
import { StorageManagementClient } from "@azure/arm-storage";
import { ResourceManagementClient } from "@azure/arm-resources";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

async function run(_input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("azure:infra-discovery started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Infrastructure discovery is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const azureCreds = await getCredentialProvider().getAzureCredentials(ctx.userId, ctx.credentialsKey);
  if (!azureCreds) {
    return {
      ok: false,
      error: "Azure connector not linked or validated. Connect your Azure account in Connectors first.",
      summary: "Azure connector required.",
    };
  }

  try {
    const { credential, subscriptionId } = azureCreds;

    const computeClient = new ComputeManagementClient(credential, subscriptionId);
    const storageClient = new StorageManagementClient(credential, subscriptionId);
    const resourceClient = new ResourceManagementClient(credential, subscriptionId);

    let vmCount = 0;
    let storageAccountCount = 0;
    let resourceGroupCount = 0;

    const [vms, storageAccounts, resourceGroups] = await Promise.all([
      collectAll(computeClient.virtualMachines.listAll()),
      collectAll(storageClient.storageAccounts.list()),
      collectAll(resourceClient.resourceGroups.list()),
    ]);

    vmCount = vms.length;
    storageAccountCount = storageAccounts.length;
    resourceGroupCount = resourceGroups.length;

    const services = [
      { type: "vm" as const, count: vmCount },
      { type: "storage_account" as const, count: storageAccountCount },
      { type: "resource_group" as const, count: resourceGroupCount },
    ];

    const summary = `VMs: ${vmCount}, Storage Accounts: ${storageAccountCount}, Resource Groups: ${resourceGroupCount}`;

    logger.info("azure:infra-discovery completed", { vmCount, storageAccountCount, resourceGroupCount });

    return {
      ok: true,
      data: {
        vmCount,
        storageAccountCount,
        resourceGroupCount,
        services,
        summary,
        subscriptionId,
      },
      summary,
    };
  } catch (e) {
    const err = e as { message?: string };
    const msg = err?.message ?? String(e);
    logger.error("azure:infra-discovery failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "Azure infrastructure discovery failed",
    };
  }
}

async function collectAll<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}

registerExecutionPlugin({
  id: "azure:infra-discovery",
  name: "Azure Infrastructure Discovery",
  description: "Discover VMs, Storage Accounts, and Resource Groups. Read-only.",
  scopesRequired: ["cloud:azure", "cloud:read"],
  readOnly: true,
  run,
});
