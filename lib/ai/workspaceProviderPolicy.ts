import "server-only";

import { prisma } from "@/lib/db";
import { isAIProviderName, type AIProviderName } from "./AIProvider";

export interface WorkspaceAIProviderPolicy {
  allowedProviders: AIProviderName[];
  fallbackOrder: AIProviderName[];
}

interface PolicyRow {
  allowedProviders: unknown;
  fallbackOrder: unknown;
}

interface PolicyRepo {
  organizationAIProviderPolicy: {
    findUnique(args: { where: { organizationId: string }; select: { allowedProviders: true; fallbackOrder: true } }): Promise<PolicyRow | null>;
    upsert(args: {
      where: { organizationId: string };
      create: { organizationId: string; allowedProviders: object; fallbackOrder: object; updatedBy: string };
      update: { allowedProviders: object; fallbackOrder: object; updatedBy: string };
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

export function normalizeWorkspaceAIProviderPolicy(input: {
  allowedProviders?: unknown;
  fallbackOrder?: unknown;
}): WorkspaceAIProviderPolicy | null {
  const allowedProviders = providerList(input.allowedProviders);
  const fallbackOrder = providerList(input.fallbackOrder);
  if (allowedProviders.length === 0) return null;
  if (fallbackOrder.some((provider) => !allowedProviders.includes(provider))) return null;
  return { allowedProviders, fallbackOrder };
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
  return {
    allowedProviders,
    fallbackOrder: [...fallbackOrder, ...allowedProviders.filter((provider) => !fallbackOrder.includes(provider))],
  };
}

export async function loadWorkspaceAIProviderPolicy(organizationId: string): Promise<WorkspaceAIProviderPolicy | null> {
  try {
    const row = await (prisma as unknown as PolicyRepo).organizationAIProviderPolicy.findUnique({
      where: { organizationId },
      select: { allowedProviders: true, fallbackOrder: true },
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
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
    update: {
      allowedProviders: input.policy.allowedProviders as unknown as object,
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
  });
}
