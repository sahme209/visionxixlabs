import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantScopedToken: vi.fn(),
  getLatestWorkflowRun: vi.fn(),
}));

vi.mock("@/lib/connectors/github/resolveTenantScopedToken", async () => {
  const actual = await vi.importActual<typeof import("@/lib/connectors/github/resolveTenantScopedToken")>(
    "@/lib/connectors/github/resolveTenantScopedToken",
  );
  return { ...actual, resolveTenantScopedToken: mocks.resolveTenantScopedToken };
});
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ getLatestWorkflowRun: mocks.getLatestWorkflowRun }));

import { executeReadOnlyTool, isProdEnvironmentTarget, type ToolExecutionRepo } from "../toolExecution";

describe("executeReadOnlyTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list_environments returns the org's environments only", async () => {
    const repo: ToolExecutionRepo = { environment: { findMany: vi.fn(async () => [{ id: "e1", slug: "dev", name: "Dev", tier: "dev" }]) } };
    const result = await executeReadOnlyTool(repo, "org-1", "list_environments", {});
    expect(result).toEqual({ ok: true, result: [{ id: "e1", slug: "dev", name: "Dev", tier: "dev" }] });
    expect(repo.environment.findMany).toHaveBeenCalledWith({ where: { organizationId: "org-1" } });
  });

  it("check_deploy_status rejects a malformed repository name", async () => {
    const repo: ToolExecutionRepo = { environment: { findMany: vi.fn() } };
    const result = await executeReadOnlyTool(repo, "org-1", "check_deploy_status", { repositoryFullName: "not-a-repo" });
    expect(result).toEqual({ ok: false, error: "invalid_repository_full_name" });
  });

  it("check_deploy_status returns the latest workflow run", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.getLatestWorkflowRun.mockResolvedValue({ ok: true, data: { status: "completed", conclusion: "success", htmlUrl: "https://x", createdAt: "2026-01-01" } });
    const repo: ToolExecutionRepo = { environment: { findMany: vi.fn() } };
    const result = await executeReadOnlyTool(repo, "org-1", "check_deploy_status", { repositoryFullName: "acme/widgets" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.result).toMatchObject({ status: "completed", conclusion: "success" });
  });

  it("check_deploy_status surfaces a 409 when there's no connected installation", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: false, error: "github_not_connected" });
    const repo: ToolExecutionRepo = { environment: { findMany: vi.fn() } };
    const result = await executeReadOnlyTool(repo, "org-1", "check_deploy_status", { repositoryFullName: "acme/widgets" });
    expect(result).toEqual({ ok: false, error: "github_not_connected" });
  });

  it("rejects any tool name outside the low-risk set", async () => {
    const repo: ToolExecutionRepo = { environment: { findMany: vi.fn() } };
    const result = await executeReadOnlyTool(repo, "org-1", "trigger_aws_deploy", {});
    expect(result.ok).toBe(false);
  });
});

describe("isProdEnvironmentTarget", () => {
  it("is false when there's no environmentId in the args", async () => {
    const repo = { environment: { findUnique: vi.fn() } };
    expect(await isProdEnvironmentTarget(repo, "org-1", {})).toBe(false);
    expect(repo.environment.findUnique).not.toHaveBeenCalled();
  });

  it("is true only for a prod-tier environment in the caller's own org", async () => {
    const repo = { environment: { findUnique: vi.fn(async () => ({ organizationId: "org-1", tier: "prod" })) } };
    expect(await isProdEnvironmentTarget(repo, "org-1", { environmentId: "env_1" })).toBe(true);
  });

  it("is false for a non-prod tier", async () => {
    const repo = { environment: { findUnique: vi.fn(async () => ({ organizationId: "org-1", tier: "dev" })) } };
    expect(await isProdEnvironmentTarget(repo, "org-1", { environmentId: "env_1" })).toBe(false);
  });

  it("is false when the environment belongs to a different org — never trust the org claim from args", async () => {
    const repo = { environment: { findUnique: vi.fn(async () => ({ organizationId: "other_org", tier: "prod" })) } };
    expect(await isProdEnvironmentTarget(repo, "org-1", { environmentId: "env_1" })).toBe(false);
  });
});
