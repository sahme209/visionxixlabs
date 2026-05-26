import { describe, expect, it } from "vitest";
import {
  ALL_CI_STATUSES,
  ALL_PR_STATES,
  ALL_WORKFLOW_RUN_CONCLUSIONS,
  ALL_WORKFLOW_RUN_KINDS,
  ALL_WORKFLOW_RUN_STATUSES,
  diffReleaseTags,
  isKnownCiStatus,
  isKnownPrState,
  listPullRequestsByCommit,
  listReleaseTagsForRepo,
  listWorkflowRunsForCommit,
  upsertPullRequestRecord,
  upsertReleaseTagRecord,
  upsertWorkflowRunRecord,
  type GitDiscoveryRepo,
  type PullRequestRecordRow,
  type ReleaseTagRecordRow,
  type WorkflowRunRecordRow,
} from "../gitDiscoveryRepo";

/* ──────────────────────────────────────────────────────────────────
   In-memory stub.
   ────────────────────────────────────────────────────────────── */

interface Stub extends GitDiscoveryRepo {
  _prs: PullRequestRecordRow[];
  _tags: ReleaseTagRecordRow[];
  _runs: WorkflowRunRecordRow[];
  _now(): Date;
}

function makeRepo(start = new Date("2026-06-01T12:00:00Z")): Stub {
  const prs: PullRequestRecordRow[] = [];
  const tags: ReleaseTagRecordRow[] = [];
  const runs: WorkflowRunRecordRow[] = [];
  let counter = 0;
  const clock = () => new Date(start.getTime() + counter * 1000);
  const nextId = () => `id_${(counter += 1)}`;

  const repo: Stub = {
    _prs: prs, _tags: tags, _runs: runs,
    _now: clock,
    pullRequestRecord: {
      async findUnique({ where }) {
        const row = prs.find((p) => p.repositoryId === where.repositoryId_number.repositoryId && p.number === where.repositoryId_number.number);
        return row ? { ...row } : null;
      },
      async findMany({ where, take }) {
        const filtered = prs.filter((p) =>
          p.organizationId === where.organizationId &&
          (where.repositoryId === undefined || p.repositoryId === where.repositoryId) &&
          (where.state === undefined || p.state === where.state) &&
          (where.commitShaHead === undefined || p.commitShaHead === where.commitShaHead),
        );
        filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return (take ? filtered.slice(0, take) : filtered).map((r) => ({ ...r }));
      },
      async upsert({ where, create, update }) {
        const existing = prs.find((p) => p.repositoryId === where.repositoryId_number.repositoryId && p.number === where.repositoryId_number.number);
        if (existing) {
          Object.assign(existing, update, { updatedAt: clock() });
          return { ...existing };
        }
        const row: PullRequestRecordRow = {
          id: nextId(),
          createdAt: clock(),
          updatedAt: clock(),
          lastSyncedAt: create.lastSyncedAt ?? clock(),
          ...create,
        };
        prs.push(row);
        return { ...row };
      },
    },
    releaseTagRecord: {
      async findUnique({ where }) {
        const row = tags.find((t) => t.repositoryId === where.repositoryId_tagName.repositoryId && t.tagName === where.repositoryId_tagName.tagName);
        return row ? { ...row } : null;
      },
      async findMany({ where, take }) {
        const f = tags.filter((t) =>
          t.organizationId === where.organizationId &&
          (where.repositoryId === undefined || t.repositoryId === where.repositoryId),
        );
        f.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return (take ? f.slice(0, take) : f).map((r) => ({ ...r }));
      },
      async upsert({ where, create, update }) {
        const ex = tags.find((t) => t.repositoryId === where.repositoryId_tagName.repositoryId && t.tagName === where.repositoryId_tagName.tagName);
        if (ex) {
          Object.assign(ex, update, { updatedAt: clock() });
          return { ...ex };
        }
        const row: ReleaseTagRecordRow = {
          id: nextId(),
          updatedAt: clock(),
          lastSyncedAt: create.lastSyncedAt ?? clock(),
          ...create,
        };
        tags.push(row);
        return { ...row };
      },
    },
    workflowRunRecord: {
      async findUnique({ where }) {
        const row = runs.find((r) => r.repositoryId === where.repositoryId_externalRunId.repositoryId && r.externalRunId === where.repositoryId_externalRunId.externalRunId);
        return row ? { ...row } : null;
      },
      async findMany({ where, take }) {
        const f = runs.filter((r) =>
          r.organizationId === where.organizationId &&
          (where.repositoryId === undefined || r.repositoryId === where.repositoryId) &&
          (where.status === undefined || r.status === where.status) &&
          (where.commitSha === undefined || r.commitSha === where.commitSha) &&
          (where.runKind === undefined || r.runKind === where.runKind),
        );
        f.sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));
        return (take ? f.slice(0, take) : f).map((r) => ({ ...r }));
      },
      async upsert({ where, create, update }) {
        const ex = runs.find((r) => r.repositoryId === where.repositoryId_externalRunId.repositoryId && r.externalRunId === where.repositoryId_externalRunId.externalRunId);
        if (ex) {
          Object.assign(ex, update, { lastSyncedAt: clock() });
          return { ...ex };
        }
        const row: WorkflowRunRecordRow = {
          id: nextId(),
          createdAt: clock(),
          lastSyncedAt: create.lastSyncedAt ?? clock(),
          ...create,
        };
        runs.push(row);
        return { ...row };
      },
    },
    async $transaction(fn) { return fn(repo); },
  };
  return repo;
}

const BASE_PR_INPUT = {
  organizationId: "o",
  repositoryId: "repo_1",
  number: 482,
  title: "Checkout retry banner",
  state: "open" as const,
  sourceBranch: "feat/retry-banner",
  targetBranch: "main",
  commitShaHead: "abc123",
  mergedAt: null,
  mergedByUserId: null,
  linkedStories: ["AXIOM-1023"],
  linkedTickets: [],
  approvalsRequiredCount: 2,
  approvalsObservedCount: 1,
  codeownersApproved: false,
  ciStatus: "passing" as const,
  webUrl: "https://github.com/org/repo/pull/482",
};

/* ──────────────────────────────────────────────────────────────────
   Closed-union guards.
   ────────────────────────────────────────────────────────────── */

describe("closed-union guards", () => {
  it("isKnownPrState accepts every PR state, rejects garbage", () => {
    for (const s of ALL_PR_STATES) expect(isKnownPrState(s)).toBe(true);
    for (const s of ["", "OPEN", "draft", "completed"]) expect(isKnownPrState(s)).toBe(false);
  });

  it("isKnownCiStatus accepts every CI status, rejects garbage", () => {
    for (const s of ALL_CI_STATUSES) expect(isKnownCiStatus(s)).toBe(true);
    for (const s of ["", "PASSING", "green", "broken"]) expect(isKnownCiStatus(s)).toBe(false);
  });

  it("ALL_* catalogs have the right shapes", () => {
    expect(ALL_PR_STATES).toEqual(["open", "merged", "closed"]);
    expect(ALL_CI_STATUSES).toEqual(["pending", "passing", "failing", "not_run"]);
    expect(ALL_WORKFLOW_RUN_STATUSES).toEqual(["queued", "in_progress", "completed"]);
    expect(ALL_WORKFLOW_RUN_CONCLUSIONS).toEqual(["success", "failure", "cancelled", "skipped", "neutral"]);
    expect(ALL_WORKFLOW_RUN_KINDS).toEqual(["build", "deploy", "check", "other"]);
  });
});

/* ──────────────────────────────────────────────────────────────────
   upsertPullRequestRecord.
   ────────────────────────────────────────────────────────────── */

describe("upsertPullRequestRecord", () => {
  it("creates a row on first observation", async () => {
    const repo = makeRepo();
    const row = await upsertPullRequestRecord(repo, BASE_PR_INPUT);
    expect(row.number).toBe(482);
    expect(row.state).toBe("open");
    expect(row.linkedStories).toEqual(["AXIOM-1023"]);
    expect(repo._prs).toHaveLength(1);
  });

  it("idempotent — second upsert of same (repoId, number) updates in place", async () => {
    const repo = makeRepo();
    await upsertPullRequestRecord(repo, BASE_PR_INPUT);
    const second = await upsertPullRequestRecord(repo, {
      ...BASE_PR_INPUT,
      state: "merged",
      mergedAt: new Date("2026-06-01T22:00:00Z"),
      mergedByUserId: "user_42",
      approvalsObservedCount: 2,
      codeownersApproved: true,
    });
    expect(repo._prs).toHaveLength(1);
    expect(second.state).toBe("merged");
    expect(second.mergedByUserId).toBe("user_42");
    expect(second.approvalsObservedCount).toBe(2);
    expect(second.codeownersApproved).toBe(true);
  });

  it("rejects unknown PR state at the application layer", async () => {
    const repo = makeRepo();
    await expect(upsertPullRequestRecord(repo, { ...BASE_PR_INPUT, state: "draft" as never })).rejects.toThrow(/Unknown PR state/);
  });

  it("rejects unknown CI status", async () => {
    const repo = makeRepo();
    await expect(upsertPullRequestRecord(repo, { ...BASE_PR_INPUT, ciStatus: "green" as never })).rejects.toThrow(/Unknown CI status/);
  });
});

/* ──────────────────────────────────────────────────────────────────
   upsertReleaseTagRecord + diff helper.
   ────────────────────────────────────────────────────────────── */

describe("upsertReleaseTagRecord + diffReleaseTags", () => {
  it("creates a tag on first observation, idempotent on second", async () => {
    const repo = makeRepo();
    const t1 = await upsertReleaseTagRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      tagName: "v1.0.0", commitSha: "aaa",
      createdAt: new Date("2026-05-01T00:00:00Z"),
      taggerUserId: "user_dev",
      prListJson: ["pr_1", "pr_2"],
      commitListJson: ["aaa", "bbb"],
      diffAgainstPreviousProdJson: null,
      notes: null,
    });
    expect(t1.tagName).toBe("v1.0.0");
    expect(t1.prListJson).toEqual(["pr_1", "pr_2"]);

    const t2 = await upsertReleaseTagRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      tagName: "v1.0.0", commitSha: "aaa",
      createdAt: new Date("2026-05-01T00:00:00Z"),
      taggerUserId: "user_dev",
      prListJson: ["pr_1", "pr_2", "pr_3"], // expanded
      commitListJson: ["aaa", "bbb", "ccc"],
      diffAgainstPreviousProdJson: { included: ["pr_3"] },
      notes: "Hotfix",
    });
    expect(repo._tags).toHaveLength(1);
    expect(t2.prListJson).toEqual(["pr_1", "pr_2", "pr_3"]);
    expect(t2.notes).toBe("Hotfix");
  });

  it("diffReleaseTags surfaces newly-included and dropped PR ids", () => {
    const from = {
      tagName: "v1.0.0",
      prListJson: ["pr_1", "pr_2", "pr_3"],
    };
    const to = {
      tagName: "v1.1.0",
      prListJson: ["pr_2", "pr_3", "pr_4", "pr_5"],
      commitListJson: ["bbb", "ccc", "ddd", "eee"],
    };
    const d = diffReleaseTags(from, to);
    expect(d.fromTag).toBe("v1.0.0");
    expect(d.toTag).toBe("v1.1.0");
    expect(d.prCount).toBe(4);
    expect(d.commitCount).toBe(4);
    expect(d.newlyIncludedPrIds.sort()).toEqual(["pr_4", "pr_5"]);
    expect(d.droppedPrIds).toEqual(["pr_1"]);
  });

  it("diffReleaseTags handles null prListJson cleanly", () => {
    const d = diffReleaseTags(
      { tagName: "v1", prListJson: null },
      { tagName: "v2", prListJson: ["pr_a"], commitListJson: ["aaa"] },
    );
    expect(d.newlyIncludedPrIds).toEqual(["pr_a"]);
    expect(d.droppedPrIds).toEqual([]);
  });
});

/* ──────────────────────────────────────────────────────────────────
   upsertWorkflowRunRecord.
   ────────────────────────────────────────────────────────────── */

describe("upsertWorkflowRunRecord", () => {
  it("creates a queued run, then transitions to completed via second upsert", async () => {
    const repo = makeRepo();
    await upsertWorkflowRunRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      workflowName: "Deploy", externalRunId: "12345",
      status: "queued", conclusion: null, runKind: "deploy",
      commitSha: "abc123", ref: "refs/tags/v2.7.0",
      startedAt: null, completedAt: null,
      webUrl: null, artifactsJson: null,
    });
    const completed = await upsertWorkflowRunRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      workflowName: "Deploy", externalRunId: "12345",
      status: "completed", conclusion: "success", runKind: "deploy",
      commitSha: "abc123", ref: "refs/tags/v2.7.0",
      startedAt: new Date("2026-06-01T22:00:00Z"),
      completedAt: new Date("2026-06-01T22:30:00Z"),
      webUrl: "https://github.com/.../runs/12345",
      artifactsJson: { artifact_id: "art_1" },
    });
    expect(repo._runs).toHaveLength(1);
    expect(completed.status).toBe("completed");
    expect(completed.conclusion).toBe("success");
    expect(completed.startedAt).not.toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────────
   Read helpers.
   ────────────────────────────────────────────────────────────── */

describe("list helpers — scope by org + filter", () => {
  it("listPullRequestsByCommit returns only PRs with matching commitShaHead", async () => {
    const repo = makeRepo();
    await upsertPullRequestRecord(repo, BASE_PR_INPUT);
    await upsertPullRequestRecord(repo, { ...BASE_PR_INPUT, number: 483, commitShaHead: "different" });
    const matches = await listPullRequestsByCommit(repo, { organizationId: "o", commitSha: "abc123" });
    expect(matches).toHaveLength(1);
    expect(matches[0].number).toBe(482);
  });

  it("listReleaseTagsForRepo returns newest-first within take limit", async () => {
    const repo = makeRepo();
    for (let i = 0; i < 5; i++) {
      await upsertReleaseTagRecord(repo, {
        organizationId: "o", repositoryId: "repo_1",
        tagName: `v1.${i}.0`, commitSha: `sha_${i}`,
        createdAt: new Date(2026, 0, 1 + i),
        taggerUserId: null, prListJson: null, commitListJson: null,
        diffAgainstPreviousProdJson: null, notes: null,
      });
    }
    const recent = await listReleaseTagsForRepo(repo, { organizationId: "o", repositoryId: "repo_1", take: 3 });
    expect(recent).toHaveLength(3);
    expect(recent[0].tagName).toBe("v1.4.0");
    expect(recent[2].tagName).toBe("v1.2.0");
  });

  it("listWorkflowRunsForCommit returns matching runs sorted by startedAt desc", async () => {
    const repo = makeRepo();
    await upsertWorkflowRunRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      workflowName: "Build", externalRunId: "100",
      status: "completed", conclusion: "success", runKind: "build",
      commitSha: "abc123", ref: "main",
      startedAt: new Date("2026-06-01T22:00:00Z"),
      completedAt: new Date("2026-06-01T22:10:00Z"),
      webUrl: null, artifactsJson: null,
    });
    await upsertWorkflowRunRecord(repo, {
      organizationId: "o", repositoryId: "repo_1",
      workflowName: "Deploy", externalRunId: "101",
      status: "completed", conclusion: "success", runKind: "deploy",
      commitSha: "abc123", ref: "main",
      startedAt: new Date("2026-06-01T22:30:00Z"),
      completedAt: new Date("2026-06-01T22:50:00Z"),
      webUrl: null, artifactsJson: null,
    });
    const runs = await listWorkflowRunsForCommit(repo, { organizationId: "o", commitSha: "abc123" });
    expect(runs.map((r) => r.externalRunId)).toEqual(["101", "100"]);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Cross-repo isolation.
   ────────────────────────────────────────────────────────────── */

describe("cross-(org, repo) isolation", () => {
  it("PRs from one repo don't bleed into another repo's findMany", async () => {
    const repo = makeRepo();
    await upsertPullRequestRecord(repo, BASE_PR_INPUT);
    await upsertPullRequestRecord(repo, { ...BASE_PR_INPUT, repositoryId: "repo_other", number: 1 });
    const found = await repo.pullRequestRecord.findMany({
      where: { organizationId: "o", repositoryId: "repo_1" },
      orderBy: { updatedAt: "desc" },
    });
    expect(found).toHaveLength(1);
    expect(found[0].repositoryId).toBe("repo_1");
  });
});
