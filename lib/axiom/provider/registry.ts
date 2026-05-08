import type { CloudProviderAdapter } from "./types";
import { AWSAdapter } from "./awsAdapter";
import { AzureAdapter } from "./azureAdapter";
import { GCPAdapter } from "./gcpAdapter";

// ---------------------------------------------------------------------------
// Provider adapter registry — singleton cache, one adapter per provider
// ---------------------------------------------------------------------------

const cache = new Map<string, CloudProviderAdapter>();

export function getAdapter(provider: "aws" | "azure" | "gcp"): CloudProviderAdapter {
  let adapter = cache.get(provider);
  if (adapter) return adapter;

  switch (provider) {
    case "aws":
      adapter = new AWSAdapter();
      break;
    case "azure":
      adapter = new AzureAdapter();
      break;
    case "gcp":
      adapter = new GCPAdapter();
      break;
  }

  cache.set(provider, adapter);
  return adapter;
}

export function getAllAdapters(): CloudProviderAdapter[] {
  return (["aws", "azure", "gcp"] as const).map(getAdapter);
}

export function isImplemented(
  provider: "aws" | "azure" | "gcp",
  method: keyof CloudProviderAdapter,
): boolean {
  return IMPLEMENTATION_STATUS[provider]?.[method] ?? false;
}

const IMPLEMENTATION_STATUS: Record<string, Record<string, boolean>> = {
  aws: {
    validateConnection: true,
    collectSnapshot: true,
    estimateCosts: true,
    generateExecutionPlan: true,
    applyAction: true,
    verifyAction: true,
    rollbackAction: true,
  },
  azure: {
    validateConnection: false,
    collectSnapshot: true,
    estimateCosts: true,
    generateExecutionPlan: true,
    applyAction: false,
    verifyAction: true,
    rollbackAction: false,
  },
  gcp: {
    validateConnection: false,
    collectSnapshot: true,
    estimateCosts: true,
    generateExecutionPlan: true,
    applyAction: false,
    verifyAction: true,
    rollbackAction: false,
  },
};
