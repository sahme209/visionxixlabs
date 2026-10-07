import "server-only";

export interface WorkspaceMemoryRow {
  repositoryFullNames: string[];
  environmentIds: string[];
}

export interface WorkspaceMemoryRepo {
  agentWorkspaceMemory: {
    findUnique(args: { where: { organizationId: string } }): Promise<WorkspaceMemoryRow | null>;
    upsert(args: {
      where: { organizationId: string };
      create: { organizationId: string; repositoryFullNames: string[]; environmentIds: string[] };
      update: { repositoryFullNames: string[]; environmentIds: string[] };
    }): Promise<WorkspaceMemoryRow>;
  };
}

const MAX_ITEMS = 20;

export async function loadWorkspaceMemory(repo: WorkspaceMemoryRepo, organizationId: string): Promise<WorkspaceMemoryRow> {
  try {
    return await repo.agentWorkspaceMemory.findUnique({ where: { organizationId } }) ?? { repositoryFullNames: [], environmentIds: [] };
  } catch {
    // The Agent remains usable while a newly deployed migration is pending.
    return { repositoryFullNames: [], environmentIds: [] };
  }
}

export async function rememberToolContext(
  repo: WorkspaceMemoryRepo,
  organizationId: string,
  args: Record<string, unknown>,
): Promise<void> {
  const current = await loadWorkspaceMemory(repo, organizationId);
  const repository = typeof args.repositoryFullName === "string" && /^[^/\s]+\/[^/\s]+$/.test(args.repositoryFullName)
    ? args.repositoryFullName
    : null;
  const environmentId = typeof args.environmentId === "string" && args.environmentId.trim() ? args.environmentId.trim() : null;
  const repositoryFullNames = repository
    ? [repository, ...current.repositoryFullNames.filter((item) => item !== repository)].slice(0, MAX_ITEMS)
    : current.repositoryFullNames;
  const environmentIds = environmentId
    ? [environmentId, ...current.environmentIds.filter((item) => item !== environmentId)].slice(0, MAX_ITEMS)
    : current.environmentIds;
  if (!repository && !environmentId) return;
  await repo.agentWorkspaceMemory.upsert({
    where: { organizationId },
    create: { organizationId, repositoryFullNames, environmentIds },
    update: { repositoryFullNames, environmentIds },
  });
}

export function workspaceMemoryPrompt(memory: WorkspaceMemoryRow): string {
  if (memory.repositoryFullNames.length === 0 && memory.environmentIds.length === 0) return "No prior workspace context has been recorded.";
  return [
    memory.repositoryFullNames.length ? `Recently used repositories: ${memory.repositoryFullNames.join(", ")}.` : "",
    memory.environmentIds.length ? `Recently used environment IDs: ${memory.environmentIds.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}
