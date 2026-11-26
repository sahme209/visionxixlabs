import { describe, expect, it } from "vitest";
import { commitFromRevision, compareGitops } from "../gitopsObservation";

const A = "a".repeat(40), B = "b".repeat(40), C = "c".repeat(40);
const obs = (appliedCommit: string | null, extra: Record<string, unknown> = {}) => ({ controller: "flux" as const, name: "apps", appliedCommit, healthy: true, ...extra });

describe("GitOps observation kernel", () => {
  it("extracts commits from Flux and Argo revision formats", () => {
    expect(commitFromRevision(`main@sha1:${A}`)).toBe(A);
    expect(commitFromRevision(A.toUpperCase())).toBe(A);
    expect(commitFromRevision("sha256:zz")).toBeNull();
    expect(commitFromRevision(null)).toBeNull();
  });
  it("classifies match, behind, outside change, unhealthy, suspended and unknown", () => {
    expect(compareGitops(A, obs(A)).state).toBe("matches");
    expect(compareGitops(A, obs(A.slice(0, 7))).state).toBe("matches");
    expect(compareGitops(B, obs(A), [A, C]).state).toBe("controller_behind");
    expect(compareGitops(B, obs(C), [A]).state).toBe("controller_differs");
    expect(compareGitops(A, obs(A, { healthy: false })).state).toBe("controller_unhealthy");
    expect(compareGitops(A, obs(A, { suspended: true })).state).toBe("suspended");
    expect(compareGitops(null, obs(A)).state).toBe("unknown");
    expect(compareGitops(A, obs(null)).state).toBe("unknown");
    expect(compareGitops(A, { ...obs(A), controller: "argocd" }).detail).toContain("Argo CD");
  });
});
