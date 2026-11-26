import { describe, expect, it, vi } from "vitest";
import { readDatabaseChangeEvidence } from "../databaseChangeEvidence";

const a = "a".repeat(40), b = "b".repeat(40);
const repo = (sha: string | null) => ({ deploymentExecution: { findFirst: vi.fn(async () => (sha ? { sourceCommitSha: sha } : null)) } });
const base = { organizationId: "o", environmentId: "e", owner: "acme", repo: "api", commitSha: b, installationToken: "t" };
describe("readDatabaseChangeEvidence", () => {
  it("reports migrations changed since the last successful deployment to this environment", async () => {
    const compare = vi.fn(async () => ({ ok: true as const, data: { files: ["prisma/migrations/x/migration.sql", "app/a.ts"], truncated: false, status: "ahead" } }));
    expect(await readDatabaseChangeEvidence(repo(a), { ...base, compare })).toEqual({ status: "detected", since: a, paths: ["prisma/migrations/x/migration.sql"], truncated: false });
    expect(compare).toHaveBeenCalledWith({ owner: "acme", repo: "api", base: a, head: b, installationToken: "t" });
  });
  it("covers first deployments, same commit, no migrations and unavailable comparisons", async () => {
    expect(await readDatabaseChangeEvidence(repo(null), base)).toEqual({ status: "first_deployment" });
    expect(await readDatabaseChangeEvidence(repo(b), base)).toEqual({ status: "same_commit", since: b });
    expect(await readDatabaseChangeEvidence(repo(a), { ...base, compare: async () => ({ ok: true as const, data: { files: ["app/a.ts"], truncated: true, status: "ahead" } }) })).toEqual({ status: "none_detected", since: a, truncated: true });
    expect(await readDatabaseChangeEvidence(repo(a), { ...base, compare: async () => ({ ok: false as const, error: "x" }) })).toEqual({ status: "unknown", reason: "compare_unavailable" });
  });
});
