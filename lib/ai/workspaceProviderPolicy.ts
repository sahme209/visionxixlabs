import "server-only";

import { prisma } from "@/lib/db";
import { isAIProviderName, type AIProviderName } from "./AIProvider";
import { defaultModelFor, isKnownModel } from "./AIModelRegistry";

export interface WorkspaceAIProviderPolicy {
  allowedProviders: AIProviderName[];
  /** One approved model per enabled provider. Never a credential or account ID. */
  modelSelections: Partial<Record<AIProviderName, string>>;
  fallbackOrder: AIProviderName[];
}

interface PolicyRow {
  allowedProviders: unknown;
  modelSelections: unknown;
  fallbackOrder: unknown;
}

interface PolicyRepo {
  organizationAIProviderPolicy: {
    findUnique(args: { where: { organizationId: string }; select: { allowedProviders: true; modelSelections: true; fallbackOrder: true } }): Promise<PolicyRow | null>;
    upsert(args: {
      where: { organizationId: string };
      create: { organizationId: string; allowedProviders: object; modelSelections: object; fallbackOrder: object; updatedBy: string };
      update: { allowedProviders: object; modelSelections: object; fallbackOrder: object; updatedBy: string };
    }): Promise<unknown>;
  };
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
  allowedProviders?: unknown;
  modelSelections?: unknown;
  fallbackOrder?: unknown;
}): WorkspaceAIProviderPolicy | null {
  const allowedProviders = providerList(input.allowedProviders);
  const fallbackOrder = providerList(input.fallbackOrder);
  const selections = modelSelections(input.modelSelections, allowedProviders);
  if (allowedProviders.length === 0) return null;
  if (!selections) return null;
  if (fallbackOrder.some((provider) => !allowedProviders.includes(provider))) return null;
  return { allowedProviders, modelSelections: selections, fallbackOrder };
}

export function resolveWorkspaceAIProviderPolicy(input: {
  stored: WorkspaceAIProviderPolicy | null;
  serviceEnabled: readonly AIProviderName[];
}): WorkspaceAIProviderPolicy {
  const serviceEnabled = providerList(input.serviceEnabled);
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
    allowedProviders,
    modelSelections: selected,
    fallbackOrder: [...fallbackOrder, ...allowedProviders.filter((provider) => !fallbackOrder.includes(provider))],
  };
}

export async function loadWorkspaceAIProviderPolicy(organizationId: string): Promise<WorkspaceAIProviderPolicy | null> {
  try {
    const row = await (prisma as unknown as PolicyRepo).organizationAIProviderPolicy.findUnique({
      where: { organizationId },
      select: { allowedProviders: true, modelSelections: true, fallbackOrder: true },
    });
    return row ? normalizeWorkspaceAIProviderPolicy(row) : null;
  } catch {
    return null;
  }
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
      allowedProviders: input.policy.allowedProviders as unknown as object,
      modelSelections: input.policy.modelSelections as object,
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
    update: {
      allowedProviders: input.policy.allowedProviders as unknown as object,
      modelSelections: input.policy.modelSelections as object,
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
  });
}
