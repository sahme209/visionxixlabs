import { describe, expect, it } from "vitest";
import {
  buildBranchEnvironmentPolicyListResponse,
  buildBranchEnvironmentPolicyCreateResponse,
  type BranchEnvironmentPolicyRepo,
  type BranchEnvironmentPolicyRow,
} from "../branchEnvironmentPolicyResponder";

interface Stub extends BranchEnvironmentPolicyRepo {
  _rows: BranchEnvironmentPolicyRow[];
  _repos: Array<{ id: string; organizationId: string }>;
  _environments: Array<{ id: string; organizationId: string }>;
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _rows: [], _repos: [{ id: "repo_1", organizationId: "o" }], _environments: [{ id: "env_1", organizationId: "o" }], _nextId: 1,
    branchEnvironmentPolicy: {
      async findMany({ where }) {
        return stub._rows.filter((r) => r.organizationId === where.organizationId).sort((a, b) => a.priority - b.priority);
      },
      async create({ data }) {
        const row: BranchEnvironmentPolicyRow = { id: `bep_${stub._nextId++}`, createdAt: new Date(), ...data };
        stub._rows.push(row);
        return row;
      },
    },
    repository: { async findUnique({ where }) { return stub._repos.find((r) => r.id === where.id) ?? null; } },
    environment: { async findUnique({ where }) { return stub._environments.find((e) => e.id === where.id) ?? null; } },
  };
  return stub;
}

const VALID = { repositoryId: "repo_1", environmentId: "env_1", branchPattern: "release/*", requireReleaseTag: true, requireCodeowners: false, requirePrLink: true, requireChangeTicket: false };

describe("buildBranchEnvironmentPolicyCreateResponse", () => {
  it("422s on a blank branch pattern", async () => {
    const r = await buildBranchEnvironmentPolicyCreateResponse(makeRepo(), { organizationId: "o", ...VALID, branchPattern: "   " });
    expect(r.status).toBe(422);
  });

  it("404s when the repository doesn't exist", async () => {
    const r = await buildBranchEnvironmentPolicyCreateResponse(makeRepo(), { organizationId: "o", ...VALID, repositoryId: "missing" });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("repository_not_found");
  });

  it("403s when the repository belongs to a different org", async () => {
    const repo = makeRepo();
    repo._repos.push({ id: "repo_other", organizationId: "other_org" });
    const r = await buildBranchEnvironmentPolicyCreateResponse(repo, { organizationId: "o", ...VALID, repositoryId: "repo_other" });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_repository");
  });

  it("404s when the environment doesn't exist", async () => {
    const r = await buildBranchEnvironmentPolicyCreateResponse(makeRepo(), { organizationId: "o", ...VALID, environmentId: "missing" });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("environment_not_found");
  });

  it("creates a real policy row with the given requirement flags", async () => {
    const repo = makeRepo();
    const r = await buildBranchEnvironmentPolicyCreateResponse(repo, { organizationId: "o", ...VALID });
    expect(r.status).toBe(201);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.requireReleaseTag).toBe(true);
    expect(r.body.data.requirePrLink).toBe(true);
    expect(r.body.data.priority).toBe(100);
  });
});

describe("buildBranchEnvironmentPolicyListResponse", () => {
  it("scopes rows to the requesting org, ordered by priority", async () => {
    const repo = makeRepo();
    await buildBranchEnvironmentPolicyCreateResponse(repo, { organizationId: "o", ...VALID, priority: 50 });
    await buildBranchEnvironmentPolicyCreateResponse(repo, { organizationId: "o", ...VALID, branchPattern: "main", priority: 10 });
    await buildBranchEnvironmentPolicyCreateResponse(repo, { organizationId: "other_org", ...VALID });
    const r = await buildBranchEnvironmentPolicyListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.policies).toHaveLength(2);
    expect(r.body.data.policies[0].branchPattern).toBe("main");
  });
});
