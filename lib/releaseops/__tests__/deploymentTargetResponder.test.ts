import { describe, expect, it } from "vitest";
import {
  buildDeploymentTargetGetResponse,
  buildDeploymentTargetUpsertResponse,
  type DeploymentTargetRepo,
  type EnvironmentForTargetRow,
  type DeploymentTargetRow,
} from "../deploymentTargetResponder";

interface Stub extends DeploymentTargetRepo {
  _environments: EnvironmentForTargetRow[];
  _targets: DeploymentTargetRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _environments: [],
    _targets: [],
    _nextId: 1,
    environment: {
      async findUnique({ where }) {
        return stub._environments.find((e) => e.id === where.id) ?? null;
      },
    },
    deploymentTarget: {
      async findUnique({ where }) {
        return stub._targets.find((t) => t.environmentId === where.environmentId) ?? null;
      },
      async upsert({ where, create, update }) {
        const existing = stub._targets.find((t) => t.environmentId === where.environmentId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: DeploymentTargetRow = { id: `dt_${stub._nextId++}`, environmentId: create.environmentId, provider: create.provider, roleArn: create.roleArn, region: create.region, ecsCluster: create.ecsCluster, ecsService: create.ecsService };
        stub._targets.push(row);
        return row;
      },
    },
  };
  return stub;
}

const VALID = {
  roleArn: "arn:aws:iam::123456789012:role/axiom-deploy",
  region: "us-east-1",
  ecsCluster: "prod-cluster",
  ecsService: "web-service",
};

describe("buildDeploymentTargetUpsertResponse", () => {
  it("404 environment_not_found", async () => {
    const r = await buildDeploymentTargetUpsertResponse(makeRepo(), { organizationId: "o", environmentId: "missing", ...VALID });
    expect(r.status).toBe(404);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("environment_not_found");
  });

  it("403 cross_org_environment", async () => {
    const repo = makeRepo();
    repo._environments.push({ id: "env_1", organizationId: "other_org" });
    const r = await buildDeploymentTargetUpsertResponse(repo, { organizationId: "o", environmentId: "env_1", ...VALID });
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_environment");
  });

  it("422 role_arn_invalid for a malformed ARN", async () => {
    const repo = makeRepo();
    repo._environments.push({ id: "env_1", organizationId: "o" });
    const r = await buildDeploymentTargetUpsertResponse(repo, { organizationId: "o", environmentId: "env_1", ...VALID, roleArn: "not-an-arn" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("role_arn_invalid");
  });

  it("422 region_invalid for a malformed region", async () => {
    const repo = makeRepo();
    repo._environments.push({ id: "env_1", organizationId: "o" });
    const r = await buildDeploymentTargetUpsertResponse(repo, { organizationId: "o", environmentId: "env_1", ...VALID, region: "not-a-region" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("region_invalid");
  });

  it("creates a new target, then updates it in place on a second call", async () => {
    const repo = makeRepo();
    repo._environments.push({ id: "env_1", organizationId: "o" });
    const created = await buildDeploymentTargetUpsertResponse(repo, { organizationId: "o", environmentId: "env_1", ...VALID });
    expect(created.status).toBe(200);
    if (!created.body.ok) throw new Error("expected ok");
    expect(created.body.data.roleArn).toBe(VALID.roleArn);
    expect(repo._targets).toHaveLength(1);

    const updated = await buildDeploymentTargetUpsertResponse(repo, {
      organizationId: "o", environmentId: "env_1", ...VALID, ecsCluster: "new-cluster",
    });
    expect(updated.status).toBe(200);
    if (!updated.body.ok) throw new Error("expected ok");
    expect(updated.body.data.ecsCluster).toBe("new-cluster");
    expect(repo._targets).toHaveLength(1); // still just one row — updated, not duplicated
  });
});

describe("buildDeploymentTargetGetResponse", () => {
  it("returns null when no target has been configured yet", async () => {
    const repo = makeRepo();
    repo._environments.push({ id: "env_1", organizationId: "o" });
    const r = await buildDeploymentTargetGetResponse(repo, "o", "env_1");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.target).toBeNull();
  });

  it("403 cross_org_environment", async () => {
    const repo = makeRepo();
    repo._environments.push({ id: "env_1", organizationId: "other_org" });
    const r = await buildDeploymentTargetGetResponse(repo, "o", "env_1");
    expect(r.status).toBe(403);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("cross_org_environment");
  });
});
