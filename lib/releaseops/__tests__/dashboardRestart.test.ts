import { expect, it, vi } from "vitest";
import { requestDashboardRestart } from "../dashboardRestart";
import type { DeploymentExecutionRow } from "../deploymentExecutionResponder";
type ServiceRepo = Parameters<typeof requestDashboardRestart>[0];
type Dependencies = NonNullable<Parameters<typeof requestDashboardRestart>[2]>;
const now = new Date("2026-10-16T01:00:00Z");
const old = new Date("2026-10-16T00:00:00Z");
const sha = "a".repeat(40);
function receipt(overrides: Partial<DeploymentExecutionRow> = {}): DeploymentExecutionRow {
    return { id: "execution", organizationId: "org", idempotencyKey: "dashboard-release:release", environmentId: "env", repositoryFullName: "owner/repo", sourceRef: "v1", sourceKind: "tag", sourceCommitSha: sha, branchPolicyId: null, promotedFromExecutionId: null, pullRequestUrl: null, workflowRunId: "123", workflowUrl: "https://github.test/run", source: "dashboard", triggeredByUserId: "user", status: "queued", conclusion: null, rollbackStatus: "not_started", lastObservedAt: null, completedAt: null, createdAt: now, updatedAt: now, ...overrides };
}
interface FixtureState {
    release: {
        id: string;
        organizationId: string;
        status: string;
        scopeFinalizedAt: Date | null;
        scopeFinalizedByUserId: string;
        releaseTag: string;
        commitSha: string;
        evidenceRepositoryId: string;
        targetEnvironmentId: string;
        updatedAt: Date;
        actualDeployStart: Date | null;
    };
    member: {
        acceptedAt: Date | null;
        role: string;
    };
    repository: {
        id: string;
        organizationId: string;
        provider: string;
        remoteOwner: string;
        remoteName: string;
        updatedAt: Date;
    };
    environment: {
        id: string;
        organizationId: string;
        tier: string;
        approvalPolicyId: string | null;
        changeWindowRuleJson: Record<string, unknown> | null;
        updatedAt: Date;
    };
    target: {
        organizationId: string;
        provider: string;
        roleArn: string;
        region: string;
        ecsCluster: string;
        ecsService: string;
        updatedAt: Date;
    };
    snapshot: {
        id: string;
        evaluatedAt: Date;
        blockersJson: unknown[];
    };
    installation: {
        id: string;
        githubInstallationId: string;
        installedAt: Date;
        status: string;
        revokedAt: Date | null;
        suspendedAt: Date | null;
    };
    prior: DeploymentExecutionRow | null;
    blocks: number;
}
interface PolicySnapshot {
    id: string;
    priority: number;
    requireTestsPassing: boolean;
}
interface ConditionalReleaseUpdate {
    where: {
        status: string;
        updatedAt?: Date;
        actualDeployStart?: Date;
    };
    data: Partial<FixtureState["release"]>;
}
function fixture() {
    const state: FixtureState = { release: { id: "release", organizationId: "org", status: "ready", scopeFinalizedAt: old, scopeFinalizedByUserId: "user", releaseTag: "v1", commitSha: sha, evidenceRepositoryId: "repo", targetEnvironmentId: "env", updatedAt: old, actualDeployStart: null }, member: { acceptedAt: old, role: "admin" }, repository: { id: "repo", organizationId: "org", provider: "github", remoteOwner: "owner", remoteName: "repo", updatedAt: old }, environment: { id: "env", organizationId: "org", tier: "dev", approvalPolicyId: null, changeWindowRuleJson: null, updatedAt: old }, target: { organizationId: "org", provider: "aws", roleArn: "role", region: "region", ecsCluster: "cluster", ecsService: "service", updatedAt: old }, snapshot: { id: "snapshot", evaluatedAt: now, blockersJson: [] }, prior: null, blocks: 0, installation: { id: "install", githubInstallationId: "123", installedAt: old, status: "active", revokedAt: null, suspendedAt: null } };
    const repo = { gitHubInstallation: { findFirst: vi.fn(async () => structuredClone(state.installation)) }, branchEnvironmentPolicy: { findMany: vi.fn(async (): Promise<PolicySnapshot[]> => []) }, orgMembership: { findUnique: vi.fn(async () => state.member) }, release: { findUnique: vi.fn(async () => structuredClone(state.release)), updateMany: vi.fn(async ({ where, data }: ConditionalReleaseUpdate) => { if (state.release.status !== where.status || (where.updatedAt && state.release.updatedAt.getTime() !== where.updatedAt.getTime()) || (where.actualDeployStart && state.release.actualDeployStart?.getTime() !== where.actualDeployStart.getTime()))
                return { count: 0 }; Object.assign(state.release, data); return { count: 1 }; }) }, repository: { findUnique: vi.fn(async () => structuredClone(state.repository)) }, environment: { findUnique: vi.fn(async () => structuredClone(state.environment)) }, deploymentTarget: { findUnique: vi.fn(async () => structuredClone(state.target)) }, releaseReadinessSnapshot: { findFirst: vi.fn(async () => structuredClone(state.snapshot)) }, policyViolation: { count: vi.fn(async () => state.blocks) }, deploymentExecution: { findUnique: vi.fn(async () => state.prior) }, $transaction: vi.fn(async (fn: (transaction: ServiceRepo) => Promise<unknown>) => { const original = structuredClone(state.release); try {
            return await fn(serviceRepo);
        }
        catch (error) {
            state.release = original;
            throw error;
        } }) };
    // The fixture models only delegates exercised by the service, not a real
    // Prisma client or PostgreSQL isolation. Keep that boundary explicit once.
    const serviceRepo = repo as unknown as ServiceRepo;
    const deps = { audit: vi.fn<Dependencies["audit"]>(async () => true), token: vi.fn<Dependencies["token"]>(async () => ({ ok: true, token: "synthetic" })), policy: vi.fn<Dependencies["policy"]>(async () => ({ ok: true, policyId: null, sourceCommitSha: sha, pullRequestUrl: null })), reserve: vi.fn<Dependencies["reserve"]>(async () => ({ ok: true, reused: false, reservation: receipt({ status: "reserved" }), planId: null, used: null, limit: null })), release: vi.fn<Dependencies["release"]>(async () => true), settle: vi.fn<Dependencies["settle"]>(async () => true), dispatch: vi.fn<Dependencies["dispatch"]>(async () => ({ ok: true, data: { workflowRunId: "123", htmlUrl: "https://github.test/run", runUrl: "https://github.test/run" } })), now: () => now };
    const run = () => requestDashboardRestart(serviceRepo, { organizationId: "org", userId: "user", releaseId: "release" }, deps);
    return { state, repo, deps, run };
}
it("claims lifecycle before exact four-input restart and shares quota identity", async () => { const f = fixture(); f.deps.dispatch.mockImplementation(async () => { expect(f.state.release.status).toBe("deploying"); return { ok: true, data: { workflowRunId: "123", htmlUrl: "https://github.test/run", runUrl: "x" } }; }); expect((await f.run()).status).toBe(200); expect(f.deps.reserve).toHaveBeenCalledWith(f.repo, expect.objectContaining({ idempotencyKey: "dashboard-release:release", source: "dashboard", sourceCommitSha: sha })); expect(f.deps.dispatch).toHaveBeenCalledWith(expect.objectContaining({ ref: "v1", inputs: { role_arn: "role", region: "region", cluster: "cluster", service: "service" } })); });
it.each(["member", "scope", "readiness", "approval", "blocking", "window"])("denies %s before quota or provider dispatch", async (kind) => { const f = fixture(); if (kind === "member")
    f.state.member.role = "operator"; if (kind === "scope")
    f.state.release.scopeFinalizedAt = null; if (kind === "readiness")
    f.state.snapshot.evaluatedAt = new Date(0); if (kind === "approval")
    f.state.environment.approvalPolicyId = "required"; if (kind === "blocking")
    f.state.blocks = 1; if (kind === "window")
    f.state.environment.changeWindowRuleJson = {}; expect((await f.run()).body.ok).toBe(false); expect(f.deps.reserve).not.toHaveBeenCalled(); expect(f.deps.dispatch).not.toHaveBeenCalled(); });
it("passes production controls into real shared policy contract before reservation", async () => { const f = fixture(); f.state.environment.tier = "prod"; f.deps.policy.mockResolvedValue({ ok: false, error: "branch_policy_promotion_artifact_unverified" }); expect((await f.run()).status).toBe(409); expect(f.deps.policy).toHaveBeenCalledWith(f.repo, expect.objectContaining({ requiredControlSet: "production", requestedCapability: "legacy_ecs_restart" })); expect(f.deps.reserve).not.toHaveBeenCalled(); });
it("denies source drift without dispatch", async () => { const f = fixture(); f.deps.policy.mockResolvedValue({ ok: true, policyId: null, sourceCommitSha: "b".repeat(40), pullRequestUrl: null }); expect((await f.run()).body).toMatchObject({ error: "release_source_changed" }); expect(f.deps.dispatch).not.toHaveBeenCalled(); });
it.each(["membership", "target", "release"])("rechecks %s after GitHub IO and releases only undispatched hold", async (kind) => { const f = fixture(); f.deps.policy.mockImplementation(async () => { if (kind === "membership")
    f.state.member.role = "operator"; if (kind === "target")
    f.state.target.updatedAt = now; if (kind === "release")
    f.state.release.updatedAt = now; return { ok: true, policyId: null, sourceCommitSha: sha, pullRequestUrl: null }; }); expect((await f.run()).status).toBe(kind === "release" ? 502 : 503); expect(f.deps.dispatch).not.toHaveBeenCalled(); if (kind === "release")
    expect(f.deps.release).not.toHaveBeenCalled();
else
    expect(f.deps.release).toHaveBeenCalled(); });
it("preserves uncertain provider outcome with claimed lifecycle and quota hold", async () => { const f = fixture(); f.deps.dispatch.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: github_503: unavailable" }); expect((await f.run()).body).toMatchObject({ error: "deployment_outcome_unknown" }); expect(f.state.release.status).toBe("deploying"); expect(f.deps.release).not.toHaveBeenCalled(); });
it("definite nonacceptance restores only owned lifecycle and frees hold", async () => { const f = fixture(); f.deps.dispatch.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: github_422: invalid ref" }); expect((await f.run()).body).toMatchObject({ error: "dispatch_failed" }); expect(f.state.release.status).toBe("ready"); expect(f.deps.release).toHaveBeenCalled(); });
it("does not retry an uncertain durable operation or bypass revoked membership on replay", async () => { const f = fixture(); f.state.prior = receipt({ status: "reserved" }); expect((await f.run()).body).toMatchObject({ error: "deployment_outcome_unknown" }); expect(f.deps.dispatch).not.toHaveBeenCalled(); f.state.member.acceptedAt = null; expect((await f.run()).status).toBe(403); });
it("quota denial cannot change lifecycle or dispatch", async () => { const f = fixture(); f.deps.reserve.mockResolvedValue({ ok: false, error: "deployment_quota_exhausted" }); expect((await f.run()).status).toBe(429); expect(f.state.release.status).toBe("ready"); expect(f.repo.$transaction).not.toHaveBeenCalled(); expect(f.deps.dispatch).not.toHaveBeenCalled(); });
it("failed lifecycle compare-and-swap prevents provider call and releases undispatched hold", async () => { const f = fixture(); f.repo.release.updateMany.mockResolvedValue({ count: 0 }); expect((await f.run()).status).toBe(503); expect(f.deps.dispatch).not.toHaveBeenCalled(); expect(f.deps.release).toHaveBeenCalled(); });
it("an accepted dispatch whose receipt storage fails retains its claim and allowance", async () => { const f = fixture(); f.deps.settle.mockResolvedValue(false); const response = await f.run(); expect(response.status).toBe(207); expect(response.body).toMatchObject({ ok: true, data: { dispatched: true, trackingAvailable: false, evidence: { sourceArtifactVerified: false, applicationHealthVerified: false } } }); expect(f.state.release.status).toBe("deploying"); expect(f.deps.release).not.toHaveBeenCalled(); });
it("does not overwrite a later operator transition after definite provider rejection", async () => { const f = fixture(); f.deps.dispatch.mockImplementation(async () => { f.state.release.status = "failed"; return { ok: false, error: "workflow_dispatch_failed: github_422: rejected" }; }); expect((await f.run()).body).toMatchObject({ error: "deployment_outcome_unknown" }); expect(f.state.release.status).toBe("failed"); expect(f.deps.release).not.toHaveBeenCalled(); });
it("replays a durable accepted receipt without policy, quota or provider work", async () => { const f = fixture(); f.state.prior = receipt(); const response = await f.run(); expect(response.status).toBe(200); expect(response.body).toMatchObject({ data: { replayed: true, execution: { evidence: { operation: "unknown", sourceArtifactVerified: false } } } }); expect(f.deps.policy).not.toHaveBeenCalled(); expect(f.deps.reserve).not.toHaveBeenCalled(); expect(f.deps.dispatch).not.toHaveBeenCalled(); });
it("emits original accepted-action audit once, never for uncertainty/replay, and audit failure cannot undo acceptance", async () => {
    const f = fixture();
    f.deps.audit.mockRejectedValue(new Error("audit unavailable"));
    expect((await f.run()).body.ok).toBe(true);
    expect(f.deps.audit).toHaveBeenCalledWith(f.repo, expect.objectContaining({ kind: "release.deploy_triggered", summary: expect.stringContaining("restart workflow accepted") }));
    const unknown = fixture();
    unknown.deps.dispatch.mockResolvedValue({ ok: false, error: "workflow_dispatch_failed: github_503: unavailable" });
    await unknown.run();
    expect(unknown.deps.audit).not.toHaveBeenCalled();
    const replay = fixture();
    replay.state.prior = receipt();
    await replay.run();
    expect(replay.deps.audit).not.toHaveBeenCalled();
});
it("uses the canonical membership composite selector", async () => { const f = fixture(); await f.run(); expect(f.repo.orgMembership.findUnique).toHaveBeenCalledWith({ where: { userId_organizationId: { organizationId: "org", userId: "user" } } }); });
it("a reused reservation still reserved is unknown, never accepted dispatch", async () => { const f = fixture(); f.deps.reserve.mockResolvedValue({ ok: true, reused: true, reservation: receipt({ status: "reserved" }), planId: null, used: null, limit: null }); expect((await f.run()).body).toMatchObject({ error: "deployment_outcome_unknown" }); expect(f.deps.dispatch).not.toHaveBeenCalled(); });
it("rejects policy edits during GitHub IO before lifecycle claim or provider dispatch", async () => { const f = fixture(); f.repo.branchEnvironmentPolicy.findMany.mockResolvedValueOnce([{ id: "policy", priority: 1, requireTestsPassing: false }]).mockResolvedValue([{ id: "policy", priority: 1, requireTestsPassing: true }]); expect((await f.run()).status).toBe(503); expect(f.deps.dispatch).not.toHaveBeenCalled(); expect(f.deps.release).toHaveBeenCalled(); });
it("post-provider receipt write throw is unknown and retains its durable hold", async () => { const f = fixture(); f.deps.settle.mockRejectedValue(new Error("database unavailable")); expect((await f.run()).body).toMatchObject({ error: "deployment_outcome_unknown" }); expect(f.deps.release).not.toHaveBeenCalled(); });
it("unknown transaction commit or unavailable cleanup read cannot free a claim", async () => { const f = fixture(); f.repo.$transaction.mockImplementation(async () => { f.state.release.status = "deploying"; throw new Error("commit response lost"); }); expect((await f.run()).body).toMatchObject({ error: "deployment_outcome_unknown" }); expect(f.deps.dispatch).not.toHaveBeenCalled(); expect(f.deps.release).not.toHaveBeenCalled(); });
it("cleanup errors stay held and do not escape to retryable framework errors", async () => { const f = fixture(); f.repo.release.updateMany.mockResolvedValue({ count: 0 }); f.deps.release.mockRejectedValue(new Error("cleanup lost")); expect((await f.run()).body).toMatchObject({ error: "deployment_outcome_unknown" }); expect(f.deps.dispatch).not.toHaveBeenCalled(); });
it("rejects a desktop client's colliding reserved key rather than replaying an unrelated operation", async () => { const f = fixture(); f.state.prior = receipt({ source: "desktop", environmentId: "other" }); expect((await f.run()).body).toMatchObject({ error: "idempotency_key_conflict" }); expect(f.deps.dispatch).not.toHaveBeenCalled(); });
it("denies GitHub installation disconnect during policy IO before dispatch", async () => { const f = fixture(); f.deps.policy.mockImplementation(async () => { f.state.installation.status = "revoked"; return { ok: true, policyId: null, sourceCommitSha: sha, pullRequestUrl: null }; }); expect((await f.run()).status).toBe(503); expect(f.deps.dispatch).not.toHaveBeenCalled(); expect(f.deps.release).toHaveBeenCalled(); });
