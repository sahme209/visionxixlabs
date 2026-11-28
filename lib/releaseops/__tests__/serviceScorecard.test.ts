import { describe, expect, it } from "vitest";
import type { CatalogRow } from "../serviceCatalog";
import { openIncidentsByRepository, rankScorecards, scoreService } from "../serviceScorecard";

const now = new Date("2026-11-28T00:00:00Z");
const row = (over: Partial<CatalogRow> = {}): CatalogRow => ({
  repository: "acme/web", components: ["web"], owners: ["Platform"], guardrails: { codeowners: true, defaultBranchProtected: true },
  environments: [], lastDeployedAt: "2026-11-25T00:00:00Z", recentFailureRate: 10, ...over,
});

describe("scoreService", () => {
  it("is strong when every known check passes", () => {
    const c = scoreService(row(), 0, now);
    expect(c.grade).toBe("strong");
    expect(c.passed).toBe(6);
    expect(c.nextStep).toBeNull();
  });
  it("fails each check on its own evidence and names the first next step", () => {
    const c = scoreService(row({ owners: [], guardrails: { codeowners: false, defaultBranchProtected: false }, lastDeployedAt: "2026-09-01T00:00:00Z", recentFailureRate: 50 }), 2, now);
    expect(c.checks.every((x) => x.state === "fail")).toBe(true);
    expect(c.grade).toBe("weak");
    expect(c.nextStep).toMatch(/owning team/);
    expect(c.checks.find((x) => x.id === "open_incidents")!.detail).toBe("2 open or mitigated.");
  });
  it("never counts unknown as a pass", () => {
    const c = scoreService(row({ recentFailureRate: null }), null, now);
    expect(c.known).toBe(4);
    expect(c.passed).toBe(4);
    expect(c.grade).toBe("strong");
    expect(c.checks.filter((x) => x.state === "unknown").map((x) => x.id)).toEqual(["success_rate", "open_incidents"]);
  });
  it("treats exactly 80% success as passing and 79% as failing", () => {
    expect(scoreService(row({ recentFailureRate: 20 }), 0, now).checks.find((x) => x.id === "success_rate")!.state).toBe("pass");
    expect(scoreService(row({ recentFailureRate: 21 }), 0, now).checks.find((x) => x.id === "success_rate")!.state).toBe("fail");
  });
  it("a never-deployed repository fails recent delivery", () => {
    const c = scoreService(row({ lastDeployedAt: null }), 0, now);
    expect(c.checks.find((x) => x.id === "recent_delivery")).toMatchObject({ state: "fail", detail: "No recorded run." });
    expect(c.grade).toBe("fair");
  });
});

describe("rankScorecards", () => {
  it("puts the weakest first", () => {
    const strong = scoreService(row({ repository: "a/strong" }), 0, now);
    const weak = scoreService(row({ repository: "b/weak", owners: [], guardrails: { codeowners: false, defaultBranchProtected: false }, lastDeployedAt: null }), 1, now);
    expect(rankScorecards([strong, weak]).map((c) => c.repository)).toEqual(["b/weak", "a/strong"]);
  });
});

describe("openIncidentsByRepository", () => {
  it("counts open and mitigated incidents through the release's repository", () => {
    const m = openIncidentsByRepository(
      [{ releaseId: "r1", status: "open" }, { releaseId: "r1", status: "mitigated" }, { releaseId: "r1", status: "resolved" }, { releaseId: "r2", status: "open" }, { releaseId: "r3", status: "open" }],
      [{ id: "r1", evidenceRepositoryId: "repo1" }, { id: "r2", evidenceRepositoryId: null }],
    );
    expect(m.get("repo1")).toBe(2);
    expect(m.size).toBe(1);
  });
});
