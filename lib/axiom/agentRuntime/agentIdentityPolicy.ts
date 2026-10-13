import "server-only";

import { prisma } from "@/lib/db";
import { TOOL_REGISTRY } from "./tools";

const TOOL_NAMES = new Set(TOOL_REGISTRY.map((tool) => tool.name));

export interface WorkspaceAgentIdentityPolicy {
  organizationId: string;
  displayName: string;
  enabled: boolean;
  allowedTools: string[];
  updatedAt: string;
  updatedBy: string;
}

function normalizeTools(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tools: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !TOOL_NAMES.has(item)) return null;
    if (!tools.includes(item)) tools.push(item);
  }
  return tools;
}

export function normalizeAgentIdentityInput(input: {
  displayName?: unknown;
  enabled?: unknown;
  allowedTools?: unknown;
}): { displayName: string; enabled: boolean; allowedTools: string[] } | null {
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
  if (!displayName || displayName.length > 80 || typeof input.enabled !== "boolean") return null;
  const allowedTools = normalizeTools(input.allowedTools);
  if (!allowedTools || (input.enabled && allowedTools.length === 0)) return null;
  return { displayName, enabled: input.enabled, allowedTools };
}

export async function readWorkspaceAgentIdentity(organizationId: string): Promise<WorkspaceAgentIdentityPolicy | null> {
  const row = await prisma.workspaceAgentIdentity.findUnique({ where: { organizationId } });
  if (!row) return null;
  return {
    organizationId: row.organizationId,
    displayName: row.displayName,
    enabled: row.enabled,
    allowedTools: normalizeTools(row.allowedTools) ?? [],
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export async function saveWorkspaceAgentIdentity(input: {
  organizationId: string;
  displayName: string;
  enabled: boolean;
  allowedTools: string[];
  updatedBy: string;
}): Promise<WorkspaceAgentIdentityPolicy> {
  const normalized = normalizeAgentIdentityInput(input);
  if (!normalized) throw new Error("invalid_agent_identity_policy");
  const row = await prisma.workspaceAgentIdentity.upsert({
    where: { organizationId: input.organizationId },
    create: { organizationId: input.organizationId, ...normalized, updatedBy: input.updatedBy },
    update: { ...normalized, updatedBy: input.updatedBy },
  });
  return {
    organizationId: row.organizationId,
    displayName: row.displayName,
    enabled: row.enabled,
    allowedTools: normalizeTools(row.allowedTools) ?? [],
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export function agentToolCatalog() {
  return TOOL_REGISTRY.map(({ name, description, riskLevel }) => ({ name, description, riskLevel }));
}
