import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTenantScopedToken: vi.fn(),
  getLatestWorkflowRun: vi.fn(),
}));

vi.mock("@/lib/connectors/github/resolveTenantScopedToken", () => ({
  resolveTenantScopedToken: mocks.resolveTenantScopedToken,
  parseRepositoryFullName: (value: string) => {
    const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
    return match ? { owner: match[1], repo: match[2] } : null;
  },
}));
vi.mock("@/lib/connectors/github/githubWriteClient", () => ({ getLatestWorkflowRun: mocks.getLatestWorkflowRun }));

import { executeReadOnlyTool, isProdEnvironmentTarget, type ToolExecutionRepo } from "../toolExecution";

function toolRepo(overrides: Partial<ToolExecutionRepo> = {}): ToolExecutionRepo {
  return {
    environment: { findMany: vi.fn(async () => []) },
    connectorSetupSession: { findMany: vi.fn(async () => []) },
    gitHubInstallation: { findFirst: vi.fn(async () => null) },
    tenantIntegrationConnection: { findMany: vi.fn(async () => []) },
    ...overrides,
  };
}

describe("executeReadOnlyTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list_environments returns the org's environments only", async () => {
    const repo = toolRepo({ environment: { findMany: vi.fn(async () => [{ id: "e1", slug: "dev", name: "Dev", tier: "dev" }]) } });
    const result = await executeReadOnlyTool(repo, "org-1", "list_environments", {});
    expect(result).toEqual({ ok: true, result: [{ id: "e1", slug: "dev", name: "Dev", tier: "dev" }] });
    expect(repo.environment.findMany).toHaveBeenCalledWith({ where: { organizationId: "org-1" } });
  });

  it("check_deploy_status rejects a malformed repository name", async () => {
    const repo = toolRepo();
    const result = await executeReadOnlyTool(repo, "org-1", "check_deploy_status", { repositoryFullName: "not-a-repo" });
    expect(result).toEqual({ ok: false, error: "invalid_repository_full_name" });
  });

  it("check_deploy_status returns the latest workflow run", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: true, token: "installation-token" });
    mocks.getLatestWorkflowRun.mockResolvedValue({ ok: true, data: { status: "completed", conclusion: "success", htmlUrl: "https://x", createdAt: "2026-01-01" } });
    const repo = toolRepo();
    const result = await executeReadOnlyTool(repo, "org-1", "check_deploy_status", { repositoryFullName: "acme/widgets" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.result).toMatchObject({ status: "completed", conclusion: "success" });
  });

  it("check_deploy_status surfaces a 409 when there's no connected installation", async () => {
    mocks.resolveTenantScopedToken.mockResolvedValue({ ok: false, error: "github_not_connected" });
    const repo = toolRepo();
    const result = await executeReadOnlyTool(repo, "org-1", "check_deploy_status", { repositoryFullName: "acme/widgets" });
    expect(result).toEqual({ ok: false, error: "github_not_connected" });
  });

  it("rejects any tool name outside the low-risk set", async () => {
    const repo = toolRepo();
    const result = await executeReadOnlyTool(repo, "org-1", "trigger_aws_deploy", {});
    expect(result.ok).toBe(false);
  });

  it("list_integrations returns conservative tenant-scoped connection states without credentials", async () => {
    const repo = toolRepo({
      connectorSetupSession: {
        findMany: vi.fn(async () => [{ provider: "aws", status: "connected", lastTransitionAt: new Date("2026-10-01T00:00:00Z") }]),
      },
      gitHubInstallation: {
        findFirst: vi.fn(async () => ({ status: "active", repositorySelection: "selected", lastSeenAt: null })),
      },
      tenantIntegrationConnection: {
        findMany: vi.fn(async () => [{ provider: "slack", status: "pending", lastValidatedAt: null }]),
      },
    });

    const result = await executeReadOnlyTool(repo, "org-1", "list_integrations", {});

    expect(result).toEqual({
      ok: true,
      result: {
        github: { status: "installation_recorded", repositorySelection: "selected" },
        cloud: [
          { provider: "aws", status: "connected", lastTransitionAt: "2026-10-01T00:00:00.000Z" },
          { provider: "azure", status: "not_connected", lastTransitionAt: null },
          { provider: "gcp", status: "not_connected", lastTransitionAt: null },
        ],
        collaboration: [
          { provider: "slack", status: "awaiting_validation", lastValidatedAt: null },
          { provider: "teams", status: "not_connected", lastValidatedAt: null },
        ],
      },
    });
    expect(repo.connectorSetupSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-1", provider: { in: ["aws", "azure", "gcp"] } } }));
  });

  it("list_integrations fails closed when connection state cannot be read", async () => {
    const repo = toolRepo({
      connectorSetupSession: { findMany: vi.fn(async () => { throw new Error("database unavailable"); }) },
    });

    await expect(executeReadOnlyTool(repo, "org-1", "list_integrations", {})).resolves.toEqual({
      ok: false,
      error: "integration_status_unavailable",
    });
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
