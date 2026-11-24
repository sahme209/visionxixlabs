import { describe, expect, it, vi } from "vitest";
import { checkDeploymentQuota, type DeploymentQuotaRepo } from "../deploymentQuota";

function quotaRepo(tier: string | null, status = "active", used = 0): DeploymentQuotaRepo {
  return {
    tenantBillingPlan: {
      findUnique: vi.fn(async () => tier ? { tier, status } : null),
    },
    deploymentExecution: { count: vi.fn(async () => used) },
  };
}

describe("checkDeploymentQuota", () => {
  it.each([
    [null, "free"],
    ["growth", "pro"],
    ["enterprise", "enterprise"],
  ])("reports activity above the former cap for %s", async (tier, planId) => {
    const repo = quotaRepo(tier, "active", 51);
    await expect(checkDeploymentQuota(repo, "org-1", new Date("2026-11-16T04:00:00Z"))).resolves.toEqual({
      allowed: true, planId, used: 51, limit: null, remaining: null,
    });
    expect(repo.deploymentExecution.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1", createdAt: {
        gte: new Date("2026-11-01T00:00:00Z"), lt: new Date("2026-12-01T00:00:00Z"),
      } },
    });
  });

  it("fails closed when billing or usage storage is unavailable", async () => {
    const repo = quotaRepo("growth");
    vi.mocked(repo.deploymentExecution.count).mockRejectedValue(new Error("database unavailable"));
    await expect(checkDeploymentQuota(repo, "org-1")).resolves.toEqual({
      allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable",
    });
  });
});
