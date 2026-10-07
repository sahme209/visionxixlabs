import { describe, expect, it, vi } from "vitest";
import { loadWorkspaceMemory, rememberToolContext, workspaceMemoryPrompt, type WorkspaceMemoryRepo } from "../workspaceMemory";

describe("Agent workspace memory", () => {
  it("fails open with empty context while the migration is unavailable", async () => {
    const repo = { agentWorkspaceMemory: { findUnique: vi.fn().mockRejectedValue(new Error("missing")) } } as unknown as WorkspaceMemoryRepo;
    await expect(loadWorkspaceMemory(repo, "org-1")).resolves.toEqual({ repositoryFullNames: [], environmentIds: [] });
  });

  it("remembers real tool identifiers and places the newest first", async () => {
    const upsert = vi.fn().mockResolvedValue({ repositoryFullNames: ["acme/widgets"], environmentIds: ["env_prod"] });
    const repo = {
      agentWorkspaceMemory: {
        findUnique: vi.fn().mockResolvedValue({ repositoryFullNames: ["acme/api"], environmentIds: [] }),
        upsert,
      },
    } as unknown as WorkspaceMemoryRepo;
    await rememberToolContext(repo, "org-1", { repositoryFullName: "acme/widgets", environmentId: "env_prod" });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { repositoryFullNames: ["acme/widgets", "acme/api"], environmentIds: ["env_prod"] },
    }));
  });

  it("renders concise context for the decision loop", () => {
    expect(workspaceMemoryPrompt({ repositoryFullNames: ["acme/widgets"], environmentIds: ["env_stage"] }))
      .toContain("acme/widgets");
  });
});
