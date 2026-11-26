import { describe, expect, it } from "vitest";
import { buildServiceCatalog } from "../serviceCatalog";

describe("buildServiceCatalog", () => {
  it("summarizes owners, guardrails, latest run per environment and recent failure rate", () => {
    const d = (s: string) => new Date(s);
    const out = buildServiceCatalog(
      [{ id: "r1", fullName: "acme/api", defaultBranch: "main", codeownersPresent: true, protectedBranches: ["main"] }, { id: "r2", fullName: "acme/web", defaultBranch: "main", codeownersPresent: false, protectedBranches: [] }],
      [{ repositoryId: "r1", name: "Payments API", ownerTeamLabel: "payments" }, { repositoryId: "r1", name: "Ledger worker", ownerTeamLabel: "payments" }],
      [
        { repositoryFullName: "acme/api", environmentId: "stg", sourceCommitSha: "aaaaaaaaaa", status: "completed", conclusion: "success", createdAt: d("2026-11-25T10:00:00Z") },
        { repositoryFullName: "acme/api", environmentId: "stg", sourceCommitSha: "bbbbbbbbbb", status: "completed", conclusion: "failure", createdAt: d("2026-11-26T10:00:00Z") },
        { repositoryFullName: "acme/api", environmentId: "prod", sourceCommitSha: "aaaaaaaaaa", status: "in_progress", conclusion: null, createdAt: d("2026-11-26T11:00:00Z") },
      ],
      [{ id: "prod", name: "Production", displayOrder: 2 }, { id: "stg", name: "Staging", displayOrder: 1 }],
    );
    expect(out.environments.map((e) => e.id)).toEqual(["stg", "prod"]);
    const api = out.rows[0];
    expect(api).toMatchObject({ repository: "acme/api", components: ["Ledger worker", "Payments API"], owners: ["payments"], guardrails: { codeowners: true, defaultBranchProtected: true }, recentFailureRate: 50, lastDeployedAt: "2026-11-26T11:00:00.000Z" });
    expect(api.environments).toEqual([{ environmentId: "stg", commit: "bbbbbbb", outcome: "failed", at: "2026-11-26T10:00:00.000Z" }, { environmentId: "prod", commit: "aaaaaaa", outcome: "in_progress", at: "2026-11-26T11:00:00.000Z" }]);
    expect(out.rows[1]).toMatchObject({ repository: "acme/web", owners: [], environments: [null, null], recentFailureRate: null, guardrails: { codeowners: false, defaultBranchProtected: false } });
  });
});
