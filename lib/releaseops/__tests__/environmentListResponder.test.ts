import { describe, expect, it } from "vitest";
import { buildEnvironmentListResponse, type EnvironmentListRepo, type EnvironmentRow } from "../environmentListResponder";

type StoredRow = EnvironmentRow & { organizationId: string };

function makeRepo(rows: StoredRow[]): EnvironmentListRepo {
  return {
    environment: {
      async findMany({ where }) {
        return rows.filter((r) => r.organizationId === where.organizationId);
      },
    },
  };
}

describe("buildEnvironmentListResponse", () => {
  it("returns an empty list for an org with no environments", async () => {
    const r = await buildEnvironmentListResponse(makeRepo([]), "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.environments).toEqual([]);
  });

  it("scopes rows to the requesting org only", async () => {
    const repo = makeRepo([
      { id: "e1", slug: "dev", name: "Development", tier: "dev", displayOrder: 0, approvalPolicyId: null, createdAt: new Date("2026-01-01") },
      { id: "e2", slug: "prod", name: "Production", tier: "prod", displayOrder: 1, approvalPolicyId: "pol_1", createdAt: new Date("2026-01-02") },
      { id: "e3", slug: "dev", name: "Other org dev", tier: "dev", displayOrder: 0, approvalPolicyId: null, createdAt: new Date("2026-01-01") },
    ].map((r, i): StoredRow => ({ ...r, organizationId: i === 2 ? "other_org" : "o" })));
    const r = await buildEnvironmentListResponse(repo, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.environments).toHaveLength(2);
    expect(r.body.data.environments.map((e) => e.slug)).toEqual(["dev", "prod"]);
    expect(r.body.data.environments[1].hasApprovalPolicy).toBe(true);
    expect(r.body.data.environments[0].hasApprovalPolicy).toBe(false);
  });

  it("503 migration_pending when the table doesn't exist yet", async () => {
    const repo: EnvironmentListRepo = {
      environment: {
        async findMany() {
          throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
        },
      },
    };
    const r = await buildEnvironmentListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });
});
