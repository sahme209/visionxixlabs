import { describe, expect, it, vi } from "vitest";
import { checkDeploymentQuota, type DeploymentQuotaRepo } from "../deploymentQuota";
import { DESIGN_PARTNER_DEPLOYMENT_OVERRIDES, FREE_MONTHLY_DEPLOYMENTS, monthlyDeploymentLimitFor } from "../deploymentAllowance";

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

  it("gives an active legacy Growth (Pro) organization the same 10 free deployments", async () => {
    await expect(checkDeploymentQuota(quotaRepo("growth", "active", 9), "org-1")).resolves.toMatchObject({
      allowed: true, planId: "pro", used: 9, limit: 10, remaining: 1,
    });
  });

  it("no longer lets a per-seat plan raise the deployment limit", async () => {
    for (const tier of ["starter", "growth", "enterprise"]) {
      await expect(checkDeploymentQuota(quotaRepo(tier, "active", 10), "org-1")).resolves.toMatchObject({
        allowed: false, used: 10, limit: 10, remaining: 0, reason: "deployment_quota_exhausted",
      });
    }
  });

  it("blocks before dispatch when the monthly allowance is exhausted", async () => {
    await expect(checkDeploymentQuota(quotaRepo("enterprise", "active", 10), "org-1")).resolves.toEqual({
      allowed: false, planId: "enterprise", used: 10, limit: 10, remaining: 0, reason: "deployment_quota_exhausted",
    });
  });

  it("applies a per-tenant design-partner override only to that organization", async () => {
    const overrides = { "org-partner": 40 };
    await expect(checkDeploymentQuota(quotaRepo(null, "no_plan", 12), "org-partner", new Date(), overrides)).resolves.toMatchObject({
      allowed: true, used: 12, limit: 40, remaining: 28,
    });
    await expect(checkDeploymentQuota(quotaRepo(null, "no_plan", 12), "org-other", new Date(), overrides)).resolves.toMatchObject({
      allowed: false, limit: 10, reason: "deployment_quota_exhausted",
    });
  });

  it("has no override by default", () => {
    expect(Object.keys(DESIGN_PARTNER_DEPLOYMENT_OVERRIDES)).toEqual([]);
    expect(FREE_MONTHLY_DEPLOYMENTS).toBe(10);
    expect(monthlyDeploymentLimitFor("any-org")).toBe(10);
  });

  it.each([-1, 1.5, Number.NaN])("fails closed on an invalid override %s", async (value) => {
    await expect(checkDeploymentQuota(quotaRepo(null, "no_plan", 0), "org-1", new Date(), { "org-1": value })).resolves.toEqual({
      allowed: false, planId: null, used: null, limit: null, remaining: 0, reason: "deployment_quota_unavailable",
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
