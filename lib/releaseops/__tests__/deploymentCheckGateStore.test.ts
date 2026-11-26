import { describe, expect, it, vi } from "vitest";
import { readDeploymentCheckGate } from "../deploymentCheckGateStore";

const now = new Date("2026-11-26T12:00:00Z");
describe("readDeploymentCheckGate", () => {
  it("passes without reading results when no blocking checks exist", async () => {
    const results = vi.fn();
    const out = await readDeploymentCheckGate({ deploymentCheck: { findMany: vi.fn(async () => []) }, deploymentCheckResult: { findMany: results } }, { organizationId: "o", commitSha: "abc", now });
    expect(out).toEqual({ ok: true, satisfied: [], notEnforceable: [] });
    expect(results).not.toHaveBeenCalled();
  });
  it("reads only this workspace's results for this commit and fails closed on errors", async () => {
    const results = vi.fn(async () => [{ checkKey: "p", checkVersion: 1, status: "passed", releaseRef: "abc", reportedAt: new Date("2026-11-26T11:00:00Z") }]);
    const repo = { deploymentCheck: { findMany: vi.fn(async () => [{ key: "p", name: "P", kind: "smoke_test" as const, stage: "verify" as const, mode: "blocking" as const, enabled: true, version: 1 }, { key: "v", name: "V", kind: "smoke_test" as const, stage: "validate" as const, mode: "blocking" as const, enabled: true, version: 1 }]) }, deploymentCheckResult: { findMany: results } };
    const out = await readDeploymentCheckGate(repo, { organizationId: "o", commitSha: "abc", now });
    expect(results).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "o", releaseRef: "abc", checkKey: { in: ["p", "v"] } } }));
    expect(out).toMatchObject({ ok: false, blocked: [{ key: "v", reason: "no_result" }] });
    repo.deploymentCheck.findMany.mockRejectedValueOnce(new Error("down"));
    expect(await readDeploymentCheckGate(repo, { organizationId: "o", commitSha: "abc", now })).toBe("unavailable");
  });
});
