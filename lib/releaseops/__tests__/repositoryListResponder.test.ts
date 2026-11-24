import { describe, expect, it, vi } from "vitest";
import {
  buildRepositoryListResponse,
  classifyProtection,
  type RepositoryListRepo,
  type RepositoryRow,
} from "../repositoryListResponder";

interface Stub extends RepositoryListRepo {
  _repos: RepositoryRow[];
}

function makeRepo(): Stub {
  const repos: RepositoryRow[] = [];
  const openPrCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const runs = new Map<string, { status: string; conclusion: string | null; workflowName: string; startedAt: Date | null; commitSha?: string | null; lastSyncedAt?: Date }>();
  const stub: Stub = {
    _repos: repos,
    repository: {
      async findMany({ where }) {
        return repos.filter((r) => r.organizationId === where.organizationId).slice().sort((a, b) => a.remoteName.localeCompare(b.remoteName));
      },
    },
    pullRequestRecord: {
      async count({ where }) {
        return openPrCounts.get(where.repositoryId) ?? 0;
      },
    },
    releaseTagRecord: {
      async count({ where }) {
        return tagCounts.get(where.repositoryId) ?? 0;
      },
    },
    workflowRunRecord: {
      async findFirst({ where }) {
        return runs.get(where.repositoryId) ?? null;
      },
    },
  };
  // Expose mutators on the stub for tests.
  (stub as Stub & { _setOpenPrCount: (id: string, n: number) => void })._setOpenPrCount = (id, n) => openPrCounts.set(id, n);
  (stub as Stub & { _setTagCount: (id: string, n: number) => void })._setTagCount = (id, n) => tagCounts.set(id, n);
  (stub as Stub & { _setRun: (id: string, run: { status: string; conclusion: string | null; workflowName: string; startedAt: Date | null; commitSha?: string | null; lastSyncedAt?: Date }) => void })._setRun = (id, run) => runs.set(id, run);
  return stub;
}

function makeRow(over: Partial<RepositoryRow> = {}): RepositoryRow {
  return {
    id: "repo_1", organizationId: "o",
    provider: "github", remoteOwner: "org", remoteName: "checkout",
    remoteUrl: "https://github.com/org/checkout",
    defaultBranch: "main", protectedBranches: ["main", "release/*"],
    codeownersPresent: true, prTemplatePresent: true, repoFlavor: "service",
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-05-01"),
    ...over,
  };
}

describe("classifyProtection", () => {
  it("strong: protected branches + codeowners + PR template", () => {
    expect(classifyProtection(makeRow())).toBe("strong");
  });
  it("weak: protected branches but missing codeowners OR PR template", () => {
    expect(classifyProtection(makeRow({ codeownersPresent: false }))).toBe("weak");
    expect(classifyProtection(makeRow({ prTemplatePresent: false }))).toBe("weak");
  });
  it("none: no protected branches", () => {
    expect(classifyProtection(makeRow({ protectedBranches: [] }))).toBe("none");
  });
});

describe("buildRepositoryListResponse", () => {
  it("empty org → 200 ok, summary zeroed", async () => {
    const repo = makeRepo();
    const r = await buildRepositoryListResponse(repo, "o", { now: new Date("2026-06-01T22:00:00Z") });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.repositories).toEqual([]);
    expect(r.body.data.summary).toEqual({ total: 0, byProvider: {}, weakProtection: 0 });
  });

  it("populated org → enriched rows with counts + last workflow + summary buckets", async () => {
    const repo = makeRepo();
    repo._repos.push(makeRow({ id: "r1", remoteName: "checkout" }));
    repo._repos.push(makeRow({ id: "r2", remoteName: "infra", provider: "gitlab", codeownersPresent: false }));
    (repo as unknown as { _setOpenPrCount: (id: string, n: number) => void })._setOpenPrCount("r1", 3);
    (repo as unknown as { _setTagCount: (id: string, n: number) => void })._setTagCount("r1", 12);
    (repo as unknown as { _setRun: (id: string, run: { status: string; conclusion: string | null; workflowName: string; startedAt: Date | null; commitSha?: string | null; lastSyncedAt?: Date }) => void })._setRun(
      "r1",
      { status: "completed", conclusion: "success", workflowName: "Deploy", startedAt: new Date("2026-05-30T12:00:00Z"), commitSha: "a".repeat(40), lastSyncedAt: new Date("2026-05-30T12:02:00Z") },
    );

    const r = await buildRepositoryListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.repositories).toHaveLength(2);
    // remoteName asc → checkout before infra
    expect(r.body.data.repositories[0].displayName).toBe("org/checkout");
    expect(r.body.data.repositories[0].openPrCount).toBe(3);
    expect(r.body.data.repositories[0].recentTagCount).toBe(12);
    expect(r.body.data.repositories[0].lastWorkflow).toMatchObject({
      name: "Deploy", commitSha: "a".repeat(40), syncedAtIso: "2026-05-30T12:02:00.000Z",
    });
    expect(r.body.data.repositories[0].protectionStrength).toBe("strong");

    expect(r.body.data.repositories[1].displayName).toBe("org/infra");
    expect(r.body.data.repositories[1].protectionStrength).toBe("weak");
    expect(r.body.data.summary.weakProtection).toBe(1);
    expect(r.body.data.summary.byProvider).toEqual({ github: 1, gitlab: 1 });
  });

  it("migration_pending degradation", async () => {
    const repo = makeRepo();
    repo.repository.findMany = async () => { throw Object.assign(new Error("relation does not exist"), { code: "P2021" }); };
    const r = await buildRepositoryListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("orders scoped workflows by known start time and breaks ties consistently", async () => {
    const repo = makeRepo();
    repo._repos.push(makeRow());
    const lookup = vi.spyOn(repo.workflowRunRecord, "findFirst").mockResolvedValue({
      workflowName: "Queued verification", status: "queued", conclusion: null, startedAt: null,
      commitSha: "b".repeat(40), lastSyncedAt: new Date("2026-05-30T12:02:00Z"),
    });
    const result = await buildRepositoryListResponse(repo, "o");
    expect(lookup).toHaveBeenCalledExactlyOnceWith({
      where: { organizationId: "o", repositoryId: "repo_1" },
      orderBy: [
        { startedAt: { sort: "desc", nulls: "last" } },
        { lastSyncedAt: "desc" },
        { id: "asc" },
      ],
    });
    if (!result.body.ok) throw new Error("expected repository records");
    expect(result.body.data.repositories[0].lastWorkflow).toMatchObject({
      name: "Queued verification", state: "queued", conclusion: null, startedAtIso: null,
      commitSha: "b".repeat(40), syncedAtIso: "2026-05-30T12:02:00.000Z",
    });
  });
});
