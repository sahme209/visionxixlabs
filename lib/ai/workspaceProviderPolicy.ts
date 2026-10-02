import "server-only";

import { prisma } from "@/lib/db";
import { isAIProviderName, type AIProviderName } from "./AIProvider";
import { defaultModelFor, isKnownModel } from "./AIModelRegistry";

export interface WorkspaceAIProviderPolicy {
  /** False is an explicit workspace-level governed-AI kill switch. */
  enabled: boolean;
  allowedProviders: AIProviderName[];
  /** One approved model per enabled provider. Never a credential or account ID. */
  modelSelections: Partial<Record<AIProviderName, string>>;
  fallbackOrder: AIProviderName[];
}

interface PolicyRow {
  enabled?: unknown;
  allowedProviders: unknown;
  modelSelections: unknown;
  fallbackOrder: unknown;
}

interface PolicyRepo {
  organizationAIProviderPolicy: {
    findUnique(args: { where: { organizationId: string }; select: { enabled: true; allowedProviders: true; modelSelections: true; fallbackOrder: true } }): Promise<PolicyRow | null>;
    upsert(args: {
      where: { organizationId: string };
      create: { organizationId: string; enabled: boolean; allowedProviders: object; modelSelections: object; fallbackOrder: object; updatedBy: string };
      update: { enabled: boolean; allowedProviders: object; modelSelections: object; fallbackOrder: object; updatedBy: string };
    }): Promise<unknown>;
  };
}

export type WorkspaceAIProviderPolicyStorageState = "ready" | "migration_pending" | "unavailable";

export function workspaceAIProviderPolicyStorageState(error: unknown): WorkspaceAIProviderPolicyStorageState {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2021" || code === "P2022") return "migration_pending";
  return "unavailable";
}

function providerList(value: unknown): AIProviderName[] {
  if (!Array.isArray(value)) return [];
  const out: AIProviderName[] = [];
  for (const item of value) {
    if (isAIProviderName(item) && item !== "mock" && !out.includes(item)) out.push(item);
  }
  return out;
}

function modelSelections(value: unknown, allowedProviders: readonly AIProviderName[]): Partial<Record<AIProviderName, string>> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const selections: Partial<Record<AIProviderName, string>> = {};
  for (const [provider, model] of Object.entries(value)) {
    if (!isAIProviderName(provider) || provider === "mock" || !allowedProviders.includes(provider) || typeof model !== "string" || !isKnownModel(provider, model)) return null;
    selections[provider] = model;
  }
  return selections;
}

export function normalizeWorkspaceAIProviderPolicy(input: {
  enabled?: unknown;
  allowedProviders?: unknown;
  modelSelections?: unknown;
  fallbackOrder?: unknown;
}): WorkspaceAIProviderPolicy | null {
  const enabled = input.enabled === undefined ? true : input.enabled;
  if (typeof enabled !== "boolean") return null;
  const allowedProviders = providerList(input.allowedProviders);
  const fallbackOrder = providerList(input.fallbackOrder);
  const selections = modelSelections(input.modelSelections, allowedProviders);
  if (!selections) return null;
  if (!enabled) {
    if (allowedProviders.length !== 0 || fallbackOrder.length !== 0 || Object.keys(selections).length !== 0) return null;
    return { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] };
  }
  if (allowedProviders.length === 0) return null;
  if (fallbackOrder.some((provider) => !allowedProviders.includes(provider))) return null;
  return { enabled: true, allowedProviders, modelSelections: selections, fallbackOrder };
}

export function resolveWorkspaceAIProviderPolicy(input: {
  stored: WorkspaceAIProviderPolicy | null;
  serviceEnabled: readonly AIProviderName[];
}): WorkspaceAIProviderPolicy {
  const serviceEnabled = providerList(input.serviceEnabled);
  if (input.stored && !input.stored.enabled) {
    return { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] };
  }
  const allowedProviders = input.stored
    ? input.stored.allowedProviders.filter((provider) => serviceEnabled.includes(provider))
    : serviceEnabled;
  const fallbackOrder = input.stored
    ? input.stored.fallbackOrder.filter((provider) => allowedProviders.includes(provider))
    : [];
  const selected = input.stored
    ? Object.fromEntries(Object.entries(input.stored.modelSelections).filter(([provider, model]) => isAIProviderName(provider) && allowedProviders.includes(provider) && isKnownModel(provider, model))) as Partial<Record<AIProviderName, string>>
    : {};
  for (const provider of allowedProviders) selected[provider] ??= defaultModelFor(provider);
  return {
    enabled: true,
    allowedProviders,
    modelSelections: selected,
    fallbackOrder: [...fallbackOrder, ...allowedProviders.filter((provider) => !fallbackOrder.includes(provider))],
  };
}

export async function loadWorkspaceAIProviderPolicyWithState(organizationId: string): Promise<{
  policy: WorkspaceAIProviderPolicy | null;
  storageState: WorkspaceAIProviderPolicyStorageState;
}> {
  try {
    const row = await (prisma as unknown as PolicyRepo).organizationAIProviderPolicy.findUnique({
      where: { organizationId },
      select: { enabled: true, allowedProviders: true, modelSelections: true, fallbackOrder: true },
    });
    return { policy: row ? normalizeWorkspaceAIProviderPolicy(row) : null, storageState: "ready" };
  } catch (error) {
    return { policy: null, storageState: workspaceAIProviderPolicyStorageState(error) };
  }
}

export async function loadWorkspaceAIProviderPolicy(organizationId: string): Promise<WorkspaceAIProviderPolicy | null> {
  return (await loadWorkspaceAIProviderPolicyWithState(organizationId)).policy;
}

export async function saveWorkspaceAIProviderPolicy(input: {
  organizationId: string;
  policy: WorkspaceAIProviderPolicy;
  updatedBy: string;
}): Promise<void> {
  await (prisma as unknown as PolicyRepo).organizationAIProviderPolicy.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      enabled: input.policy.enabled,
      allowedProviders: input.policy.allowedProviders as unknown as object,
      modelSelections: input.policy.modelSelections as object,
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
    update: {
      enabled: input.policy.enabled,
      allowedProviders: input.policy.allowedProviders as unknown as object,
      modelSelections: input.policy.modelSelections as object,
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
  });
}
