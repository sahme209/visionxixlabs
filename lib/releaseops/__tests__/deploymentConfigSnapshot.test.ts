import { describe, expect, it, vi } from "vitest";
import { recordDeploymentConfigSnapshot } from "../deploymentConfigSnapshot";
import { resolvedDigest } from "../scopedVariables";

const repo = (rows: Array<{ key: string; value: string; scopeKey: string }>, count = 1, tags: string[] = [], sets: Array<{ slug: string; name: string; selector: string }> = []) => ({
  configVariable: { findMany: vi.fn(async () => rows) },
  environment: { findFirst: vi.fn(async () => ({ tags })) },
  variableSet: { findMany: vi.fn(async () => sets) },
  deploymentExecution: { updateMany: vi.fn(async () => ({ count })) },
});
describe("recordDeploymentConfigSnapshot", () => {
  it("records the environment's resolved variables once, scoped to the workspace", async () => {
    const r = repo([{ key: "A", value: "1", scopeKey: "workspace" }, { key: "A", value: "2", scopeKey: "env:prod" }]);
    const out = await recordDeploymentConfigSnapshot(r, { organizationId: "o", environmentId: "prod", executionId: "x" });
    expect(out).toEqual({ recorded: true, digest: resolvedDigest([{ key: "A", value: "2", source: "environment" }]), count: 1 });
    expect(r.deploymentExecution.updateMany).toHaveBeenCalledWith({ where: { id: "x", organizationId: "o", configDigest: null }, data: { configDigest: out.recorded ? out.digest : "", configSnapshot: [["A", "2"]] } });
  });
  it("never overwrites an existing snapshot and never throws", async () => {
    expect(await recordDeploymentConfigSnapshot(repo([], 0), { organizationId: "o", environmentId: "e", executionId: "x" })).toEqual({ recorded: false, reason: "already_recorded" });
    const broken = repo([]); broken.configVariable.findMany.mockRejectedValueOnce(new Error("down"));
    expect(await recordDeploymentConfigSnapshot(broken, { organizationId: "o", environmentId: "e", executionId: "x" })).toEqual({ recorded: false, reason: "unavailable" });
  });
  it("includes variable sets matched by the environment's tags", async () => {
    const r = repo([{ key: "A", value: "1", scopeKey: "workspace" }, { key: "B", value: "eu", scopeKey: "set:eu" }], 1, ["region:eu"], [{ slug: "eu", name: "EU", selector: "region:eu" }]);
    const out = await recordDeploymentConfigSnapshot(r, { organizationId: "o", environmentId: "prod", executionId: "x" });
    expect(out).toMatchObject({ recorded: true, count: 2 });
    expect(r.deploymentExecution.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ configSnapshot: [["A", "1"], ["B", "eu"]] }) }));
    expect(r.environment.findFirst).toHaveBeenCalledWith({ where: { id: "prod", organizationId: "o" }, select: { tags: true } });
  });
});
