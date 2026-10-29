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

// Memory is a small recent-identifier hint, never an unbounded prompt archive.
export const WORKSPACE_MEMORY_MAX_ITEMS = 20;
export const WORKSPACE_MEMORY_MAX_PROMPT_BYTES = 8 * 1024;
export const WORKSPACE_MEMORY_MAX_ENVIRONMENT_ID_BYTES = 256;
export const WORKSPACE_MEMORY_MAX_REPOSITORY_BYTES = 201;
// Legacy rows may contain arbitrary arrays. Inspect only a bounded recent prefix.
const MAX_SCAN_ITEMS = 100;
const EMPTY_MESSAGE = "No prior workspace context has been recorded.";
const emptyMemory = (): WorkspaceMemoryRow => ({ repositoryFullNames: [], environmentIds: [] });

function identifier(value: unknown, maxBytes: number): string | null {
  if (typeof value !== "string" || value.length > maxBytes || /[\x00-\x1f\x7f]/.test(value)) return null;
  const text = value.trim();
  if (!text) return null;
  const bytes = Buffer.from(text, "utf8");
  // Refuse malformed Unicode rather than silently replacing/truncating an ID.
  return bytes.byteLength <= maxBytes && bytes.toString("utf8") === text ? text : null;
}

function repositoryName(value: unknown): string | null {
  const text = identifier(value, WORKSPACE_MEMORY_MAX_REPOSITORY_BYTES);
  return text && /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(text) ? text : null;
}

function render(memory: WorkspaceMemoryRow): string {
  return [
    memory.repositoryFullNames.length ? `Recently used repositories: ${memory.repositoryFullNames.join(", ")}.` : "",
    memory.environmentIds.length ? `Recently used environment IDs: ${memory.environmentIds.join(", ")}.` : "",
  ].filter(Boolean).join("\n") || EMPTY_MESSAGE;
}

/** Normalize database reads, tool updates and direct prompt inputs alike. Keep
 * valid recent identifiers intact; never truncate an identifier into a new one. */
export function normalizeWorkspaceMemory(value: unknown): WorkspaceMemoryRow {
  const result = emptyMemory();
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const row = value as Record<string, unknown>;
  for (const category of ["repositoryFullNames", "environmentIds"] as const) {
    const source = row[category];
    if (!Array.isArray(source)) continue;
    const seen = new Set<string>();
    for (let index = 0; index < Math.min(source.length, MAX_SCAN_ITEMS) && result[category].length < WORKSPACE_MEMORY_MAX_ITEMS; index++) {
      const item = category === "repositoryFullNames" ? repositoryName(source[index]) : identifier(source[index], WORKSPACE_MEMORY_MAX_ENVIRONMENT_ID_BYTES);
      if (!item) continue;
      const identity = category === "repositoryFullNames" ? item.toLowerCase() : item;
      if (seen.has(identity)) continue;
      seen.add(identity);
      result[category].push(item);
      if (Buffer.byteLength(render(result), "utf8") > WORKSPACE_MEMORY_MAX_PROMPT_BYTES) result[category].pop();
    }
  }
  return result;
}

export async function loadWorkspaceMemory(repo: WorkspaceMemoryRepo, organizationId: string): Promise<WorkspaceMemoryRow> {
  try {
    const stored = await repo.agentWorkspaceMemory.findUnique({ where: { organizationId } });
    return normalizeWorkspaceMemory(stored);
  } catch {
    // The Agent remains usable while a newly deployed migration is pending.
    return emptyMemory();
  }
}

export async function rememberToolContext(
  repo: WorkspaceMemoryRepo,
  organizationId: string,
  args: Record<string, unknown>,
): Promise<void> {
  const current = await loadWorkspaceMemory(repo, organizationId);
  const repository = repositoryName(args.repositoryFullName);
  const environmentId = identifier(args.environmentId, WORKSPACE_MEMORY_MAX_ENVIRONMENT_ID_BYTES);
  if (!repository && !environmentId) return;
  const normalized = normalizeWorkspaceMemory({
    repositoryFullNames: repository ? [repository, ...current.repositoryFullNames] : current.repositoryFullNames,
    environmentIds: environmentId ? [environmentId, ...current.environmentIds] : current.environmentIds,
  });
  await repo.agentWorkspaceMemory.upsert({
    where: { organizationId },
    create: { organizationId, ...normalized },
    update: normalized,
  });
}

export function workspaceMemoryPrompt(memory: WorkspaceMemoryRow): string {
  return render(normalizeWorkspaceMemory(memory));
}
