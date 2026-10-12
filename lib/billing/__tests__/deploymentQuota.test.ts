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
  it("treats an organization without a paid subscription as Free", async () => {
    await expect(checkDeploymentQuota(quotaRepo(null, "no_plan", 4), "org-1")).resolves.toMatchObject({
      allowed: true, planId: "free", used: 4, limit: 10, remaining: 6,
    });
  });

  it("maps the active legacy Growth tier to Pro", async () => {
    await expect(checkDeploymentQuota(quotaRepo("growth", "active", 99), "org-1")).resolves.toMatchObject({
      allowed: true, planId: "pro", limit: 100, remaining: 1,
    });
  });

  it("blocks before dispatch when the monthly allowance is exhausted", async () => {
    await expect(checkDeploymentQuota(quotaRepo("enterprise", "active", 500), "org-1")).resolves.toEqual({
      allowed: false, planId: "enterprise", used: 500, limit: 500, remaining: 0, reason: "deployment_quota_exhausted",
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
