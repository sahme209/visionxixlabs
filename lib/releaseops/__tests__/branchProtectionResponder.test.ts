import { describe, expect, it } from "vitest";
import {
  projectGitHubBranchProtection,
  buildBranchProtectionRefreshResponse,
  buildBranchProtectionListResponse,
  type BranchProtectionRepo,
  type BranchProtectionRow,
  type RepositoryRow,
} from "../branchProtectionResponder";

interface Stub extends BranchProtectionRepo {
  _repos: RepositoryRow[];
  _snapshots: BranchProtectionRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _repos: [],
    _snapshots: [],
    _nextId: 1,
    repository: {
      async findUnique({ where }) {
        return stub._repos.find((r) => r.id === where.id) ?? null;
      },
    },
    branchProtectionSnapshot: {
      async upsert({ where, create, update }) {
        const k = where.repositoryId_branchName;
        const idx = stub._snapshots.findIndex(
          (s) => s.repositoryId === k.repositoryId && s.branchName === k.branchName,
        );
        if (idx >= 0) {
          stub._snapshots[idx] = {
            ...stub._snapshots[idx],
            ...update,
            updatedAt: new Date(),
          };
          return stub._snapshots[idx];
        }
        const row: BranchProtectionRow = {
          id: `bps_${stub._nextId++}`,
          organizationId: create.organizationId,
          repositoryId: create.repositoryId,
          branchName: create.branchName,
          strength: create.strength,
          requiresPullRequest: create.requiresPullRequest,
          requiredReviewCount: create.requiredReviewCount,
          dismissStaleReviews: create.dismissStaleReviews,
          requireCodeOwnerReviews: create.requireCodeOwnerReviews,
          requiresStatusChecks: create.requiresStatusChecks,
          requiredStatusCheckContexts: create.requiredStatusCheckContexts,
          requiresSignedCommits: create.requiresSignedCommits,
          requiresLinearHistory: create.requiresLinearHistory,
          enforceAdmins: create.enforceAdmins,
          allowsForcePushes: create.allowsForcePushes,
          allowsDeletions: create.allowsDeletions,
          source: create.source,
          fetchedAt: new Date(),
          updatedAt: new Date(),
        };
        stub._snapshots.push(row);
        return row;
      },
      async findMany({ where, orderBy: _ }) {
        const out = stub._snapshots.filter((s) => {
          if (s.organizationId !== where.organizationId) return false;
          if (where.repositoryId !== undefined && s.repositoryId !== where.repositoryId) return false;
          return true;
        });
        return [...out].sort((a, b) => a.branchName.localeCompare(b.branchName));
      },
    },
  };
  return stub;
}

describe("projectGitHubBranchProtection", () => {
  it("returns 'none' on empty payload", () => {
    const p = projectGitHubBranchProtection({});
    expect(p.strength).toBe("none");
    expect(p.requiresPullRequest).toBe(false);
  });

  it("returns 'weak' when only PR review at 1 reviewer", () => {
    const p = projectGitHubBranchProtection({
      required_pull_request_reviews: { required_approving_review_count: 1 },
    });
    expect(p.strength).toBe("weak");
    expect(p.requiresPullRequest).toBe(true);
    expect(p.requiredReviewCount).toBe(1);
  });

  it("returns 'strong' with full posture", () => {
    const p = projectGitHubBranchProtection({
      required_pull_request_reviews: {
        required_approving_review_count: 2,
        dismiss_stale_reviews: true,
        require_code_owner_reviews: true,
      },
      required_status_checks: { contexts: ["ci/build", "ci/test"] },
      required_signatures: { enabled: true },
      required_linear_history: { enabled: true },
      enforce_admins: { enabled: true },
      allow_force_pushes: { enabled: false },
      allow_deletions: { enabled: false },
    });
    expect(p.strength).toBe("strong");
    expect(p.requiresStatusChecks).toBe(true);
    expect(p.requiredStatusCheckContexts).toEqual(["ci/build", "ci/test"]);
  });

  it("downgrades to 'weak' when force-push allowed", () => {
    const p = projectGitHubBranchProtection({
      required_pull_request_reviews: { required_approving_review_count: 2 },
      required_status_checks: { contexts: ["ci/build"] },
      required_signatures: { enabled: true },
      enforce_admins: { enabled: true },
      allow_force_pushes: { enabled: true },
    });
    expect(p.strength).toBe("weak");
    expect(p.allowsForcePushes).toBe(true);
  });

  it("tolerates legacy boolean-shaped flags", () => {
    const p = projectGitHubBranchProtection({
      enforce_admins: true,
      allow_force_pushes: false,
    });
    expect(p.enforceAdmins).toBe(true);
    expect(p.allowsForcePushes).toBe(false);
  });
});

describe("buildBranchProtectionRefreshResponse", () => {
  function repo(stub: Stub) {
    const r: RepositoryRow = { id: "repo_1", organizationId: "o", remoteOwner: "acme", remoteName: "checkout" };
    stub._repos.push(r);
    return r;
  }

  it("422 branch_name_required", async () => {
    const stub = makeRepo();
    repo(stub);
    const r = await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "  ", payload: {},
    });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("branch_name_required");
  });

  it("404 repository_not_found", async () => {
    const stub = makeRepo();
    const r = await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "missing", branchName: "main", payload: {},
    });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("repository_not_found");
  });

  it("403 cross_org_repository", async () => {
    const stub = makeRepo();
    stub._repos.push({ id: "repo_1", organizationId: "other", remoteOwner: "a", remoteName: "b" });
    const r = await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "main", payload: {},
    });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_repository");
  });

  it("200 inserts on first refresh", async () => {
    const stub = makeRepo();
    repo(stub);
    const r = await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "main",
      payload: {
        required_pull_request_reviews: { required_approving_review_count: 2 },
        required_status_checks: { contexts: ["ci/build"] },
        required_signatures: { enabled: true },
        enforce_admins: { enabled: true },
      },
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.strength).toBe("strong");
    expect(stub._snapshots).toHaveLength(1);
  });

  it("200 upserts on repeat — strength flips when payload changes", async () => {
    const stub = makeRepo();
    repo(stub);
    await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "main",
      payload: { required_pull_request_reviews: { required_approving_review_count: 2 }, required_status_checks: { contexts: ["ci/build"] }, required_signatures: { enabled: true }, enforce_admins: { enabled: true } },
    });
    const r = await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "main",
      payload: { required_pull_request_reviews: { required_approving_review_count: 2 }, allow_force_pushes: { enabled: true } },
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.strength).toBe("weak");
    expect(stub._snapshots).toHaveLength(1);
    expect(stub._snapshots[0].allowsForcePushes).toBe(true);
  });

  it("503 migration_pending", async () => {
    const stub = makeRepo();
    repo(stub);
    stub.branchProtectionSnapshot.upsert = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "main", payload: {},
    });
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});

describe("buildBranchProtectionListResponse", () => {
  it("200 empty", async () => {
    const stub = makeRepo();
    const r = await buildBranchProtectionListResponse(stub, { organizationId: "o" });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.snapshots).toHaveLength(0);
  });

  it("200 lists snapshots + summary counts", async () => {
    const stub = makeRepo();
    stub._repos.push({ id: "repo_1", organizationId: "o", remoteOwner: "a", remoteName: "checkout" });
    await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "main",
      payload: { required_pull_request_reviews: { required_approving_review_count: 2 }, required_status_checks: { contexts: ["x"] }, required_signatures: { enabled: true }, enforce_admins: { enabled: true } },
    });
    await buildBranchProtectionRefreshResponse(stub, {
      organizationId: "o", repositoryId: "repo_1", branchName: "develop",
      payload: { required_pull_request_reviews: { required_approving_review_count: 1 } },
    });
    const r = await buildBranchProtectionListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary).toEqual({ total: 2, strong: 1, weak: 1, none: 0 });
    // sorted by branch name asc
    expect(r.body.data.snapshots.map((s) => s.branchName)).toEqual(["develop", "main"]);
  });
});
