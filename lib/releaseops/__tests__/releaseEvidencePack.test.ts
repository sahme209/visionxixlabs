import { describe, expect, it } from "vitest";
import { buildReleaseEvidencePack, canonicalize, type ReleaseEvidencePackInput } from "../releaseEvidencePack";

const dep = (over: Record<string, unknown> = {}) => ({ id: "d1", environment: "staging", environmentTier: "staging", sourceRef: "main", triggeredByUserId: "u1", source: "desktop", status: "completed", conclusion: "success", rollbackStatus: "not_started", branchPolicyId: null, pullRequestUrl: null, workflowUrl: "https://github.com/a/b/actions/runs/1", configDigest: "abc", createdAt: "2026-11-26T10:00:00.000Z", completedAt: "2026-11-26T10:05:00.000Z", ...over });
const input = (over: Partial<ReleaseEvidencePackInput> = {}): ReleaseEvidencePackInput => ({
  organizationId: "org1", repositoryFullName: "acme/web", commitSha: "A".repeat(40), generatedAt: "2026-11-26T12:00:00.000Z",
  deployments: [dep({ id: "d2", environment: "prod", environmentTier: "prod", createdAt: "2026-11-26T11:00:00.000Z", pullRequestUrl: "https://github.com/acme/web/pull/7" }), dep()],
  checkResults: [{ checkKey: "smoke", checkVersion: 2, stage: "staging", status: "passed", environment: "staging", runUrl: null, reportedAt: "2026-11-26T10:06:00.000Z" }],
  auditEvents: [], ...over,
});

describe("release evidence pack", () => {
  it("summarizes deployments, checks and environments, sorted deterministically", () => {
    const { pack } = buildReleaseEvidencePack(input());
    expect(pack.subject.commitSha).toBe("a".repeat(40));
    expect(pack.deployments.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(pack.summary).toEqual({ deployments: 2, successfulDeployments: 2, environmentsReached: ["prod", "staging"], checksPassed: 1, checksFailed: 0, auditEvents: 0 });
    expect(pack.gaps).toEqual([]);
  });
  it("gives the same digest for the same evidence regardless of order or export time", () => {
    const a = buildReleaseEvidencePack(input());
    const b = buildReleaseEvidencePack(input({ generatedAt: "2027-01-01T00:00:00.000Z", deployments: [...input().deployments].reverse() }));
    expect(a.digest).toBe(b.digest);
    expect(a.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(buildReleaseEvidencePack(input({ checkResults: [] })).digest).not.toBe(a.digest);
    expect(JSON.parse(a.body).digest.value).toBe(a.digest);
  });
  it("lists missing evidence as gaps instead of inventing it", () => {
    const { pack } = buildReleaseEvidencePack(input({ deployments: [dep({ environment: "prod", environmentTier: "prod", configDigest: null, status: "in_progress", conclusion: null })], checkResults: [] }));
    expect(pack.gaps).toEqual([
      "No deployment check results were reported by CI for this commit.",
      "Some deployments have no recorded configuration fingerprint (dispatched before fingerprints were recorded).",
      "Some deployments have no confirmed final outcome yet.",
      "No production deployment records a branch policy or reviewed pull request.",
    ]);
    expect(buildReleaseEvidencePack(input({ deployments: [] })).pack.gaps[0]).toMatch(/No deployment of this commit/);
  });
  it("canonicalizes independent of key order", () => {
    expect(canonicalize({ b: [1, { d: 1, c: 2 }], a: null })).toBe('{"a":null,"b":[1,{"c":2,"d":1}]}');
  });
});
