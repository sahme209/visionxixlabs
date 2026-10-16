import "server-only";
import type { PrismaClient, Prisma } from "@prisma/client";
import { appendAuditEvent, type AuditEventRepo } from "./auditEventResponder";
import { applyTransition, type ReleaseStatus } from "./releaseLifecycleResponder";
import { deploymentEvidence } from "./deploymentEvidence";
import { serializeDeploymentExecution, type DeploymentExecutionRow } from "./deploymentExecutionResponder";
import { evaluateDeploymentPolicy, type DeploymentPolicyRepo } from "./deploymentPolicyGuard";
import { reserveDeploymentDispatch, releaseDeploymentDispatch, settleDeploymentDispatch, type DeploymentReservationRepo } from "@/lib/billing/deploymentDispatchReservation";
import { resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import { dispatchWorkflow } from "@/lib/connectors/github/githubWriteClient";
import { isDefiniteWorkflowDispatchRejection } from "@/lib/connectors/github/workflowDispatchOutcome";
import { AWS_ECS_DEPLOY_WORKFLOW_FILENAME } from "./awsEcsDeployWorkflowTemplate";
type Repo = Pick<PrismaClient, "release" | "repository" | "environment" | "deploymentTarget" | "orgMembership" | "releaseReadinessSnapshot" | "policyViolation" | "deploymentExecution" | "auditEvent" | "branchEnvironmentPolicy" | "gitHubInstallation" | "$transaction">;
const fail = (error: string, status = 409) => ({ status, body: { ok: false as const, error } });
const defaults = { token: resolveTenantScopedToken, policy: evaluateDeploymentPolicy, reserve: reserveDeploymentDispatch, release: releaseDeploymentDispatch, settle: settleDeploymentDispatch, dispatch: dispatchWorkflow, audit: appendAuditEvent, now: () => new Date() };
async function membership(repo: Pick<Prisma.TransactionClient, "orgMembership">, organizationId: string, userId: string) {
    const row = await repo.orgMembership.findUnique({ where: { userId_organizationId: { organizationId, userId } } });
    return Boolean(row?.acceptedAt && (row.role === "owner" || row.role === "admin"));
}
export async function requestDashboardRestart(repo: Repo, input: {
    organizationId: string;
    userId: string;
    releaseId: string;
}, deps = defaults) {
    const { organizationId, userId, releaseId } = input;
    const key = `dashboard-release:${releaseId}`;
    let claimedAt: Date | undefined;
    let reservationId: string | undefined;
    let claimCommitted = false;
    let providerInvoked = false;
    let initialReleaseSnapshot: {
        updatedAt: Date;
        actualDeployStart: Date | null;
    } | undefined;
    let claimUpdatedAt: Date | undefined;
    try {
        if (!await membership(repo, organizationId, userId))
            return fail("forbidden_role", 403);
        const release = await repo.release.findUnique({ where: { id: releaseId } });
        if (!release || release.organizationId !== organizationId)
            return fail("release_not_found", 404);
        // A durable accepted/uncertain operation never becomes a new dispatch when
        // the release or policy changes. Returning its existing receipt is read-only.
        const prior = await repo.deploymentExecution.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: key } } });
        if (prior) {
            const boundRepository = release.evidenceRepositoryId ? await repo.repository.findUnique({ where: { id: release.evidenceRepositoryId } }) : null;
            if (prior.source !== "dashboard" || prior.environmentId !== release.targetEnvironmentId || prior.sourceKind !== "tag" || prior.sourceRef !== release.releaseTag || prior.sourceCommitSha !== release.commitSha || !boundRepository || boundRepository.organizationId !== organizationId || prior.repositoryFullName !== `${boundRepository.remoteOwner}/${boundRepository.remoteName}` || !["reserved", "queued", "in_progress", "completed", "tracking_unavailable"].includes(prior.status))
                return fail("idempotency_key_conflict");
            if (prior.status === "reserved")
                return fail("deployment_outcome_unknown");
            return { status: 200, body: { ok: true as const, data: { releaseId, status: release.status, dispatched: true, replayed: true, execution: serializeDeploymentExecution(prior as DeploymentExecutionRow), evidence: deploymentEvidence("service_restart") } } };
        }
        if (release.status !== "ready")
            return fail("illegal_transition");
        if (!release.evidenceRepositoryId)
            return fail("release_missing_repository");
        if (!release.targetEnvironmentId)
            return fail("release_missing_environment");
        if (!release.scopeFinalizedAt || !release.scopeFinalizedByUserId || !release.releaseTag || !release.commitSha || !/^[a-f0-9]{40}$/.test(release.commitSha))
            return fail("release_scope_unverified");
        const repository = await repo.repository.findUnique({ where: { id: release.evidenceRepositoryId } });
        if (!repository || repository.organizationId !== organizationId)
            return fail("repository_not_found", 404);
        if (repository.provider !== "github")
            return fail("repository_not_github", 422);
        const environment = await repo.environment.findUnique({ where: { id: release.targetEnvironmentId } });
        if (!environment || environment.organizationId !== organizationId)
            return fail("environment_not_found", 404);
        const target = await repo.deploymentTarget.findUnique({ where: { environmentId: environment.id } });
        if (!target || target.organizationId !== organizationId || target.provider !== "aws")
            return fail("deployment_target_not_configured");
        if (environment.approvalPolicyId)
            return fail("restart_approval_evidence_unavailable");
        const latestMutation = Math.max(...[release.updatedAt, repository.updatedAt, environment.updatedAt, target.updatedAt].map(d => d.getTime()));
        const readiness = await repo.releaseReadinessSnapshot.findFirst({ where: { organizationId, releaseId }, orderBy: { evaluatedAt: "desc" } });
        if (!readiness || readiness.evaluatedAt.getTime() < latestMutation || !Array.isArray(readiness.blockersJson) || readiness.blockersJson.length !== 0)
            return fail("restart_readiness_unverified");
        const blockers = await repo.policyViolation.count({ where: { organizationId, releaseId, status: { not: "resolved" }, rule: { blocking: true } } });
        if (blockers !== 0)
            return fail("restart_policy_blocked");
        if (environment.changeWindowRuleJson !== null || release.plannedWindowStart || release.plannedWindowEnd)
            return fail("restart_change_window_unverified");
        const policyQuery = { where: { organizationId, repositoryId: repository.id, environmentId: environment.id, enabled: true }, orderBy: [{ priority: "asc" as const }] };
        const policySnapshot = await repo.branchEnvironmentPolicy.findMany(policyQuery);
        const policyFingerprint = (rows: typeof policySnapshot) => JSON.stringify([...rows].sort((left, right) => left.id.localeCompare(right.id)));
        const installationQuery = { where: { organizationId, status: "active" }, orderBy: { installedAt: "desc" as const }, select: { id: true, githubInstallationId: true, installedAt: true, status: true, revokedAt: true, suspendedAt: true } };
        const installation = await repo.gitHubInstallation.findFirst(installationQuery);
        if (!installation || installation.revokedAt || installation.suspendedAt)
            return fail("github_not_connected");
        const token = await deps.token(organizationId, { owner: repository.remoteOwner, repo: repository.remoteName });
        if (!token.ok)
            return fail(token.error);
        const policy = await deps.policy(repo as unknown as DeploymentPolicyRepo, { organizationId, environmentId: environment.id, owner: repository.remoteOwner, repo: repository.remoteName, sourceRef: release.releaseTag, sourceKind: "tag", requestedCapability: "legacy_ecs_restart", ...(environment.tier === "prod" ? { requiredControlSet: "production" as const } : {}), installationToken: token.token });
        if (!policy.ok)
            return fail(policy.error);
        if (policy.sourceCommitSha !== release.commitSha)
            return fail("release_source_changed");
        const reservation = await deps.reserve(repo as unknown as DeploymentReservationRepo, { organizationId, idempotencyKey: key, environmentId: environment.id, repositoryFullName: `${repository.remoteOwner}/${repository.remoteName}`, sourceRef: release.releaseTag, sourceKind: "tag", sourceCommitSha: policy.sourceCommitSha, branchPolicyId: policy.policyId, promotedFromExecutionId: null, pullRequestUrl: policy.pullRequestUrl, source: "dashboard", triggeredByUserId: userId });
        if (!reservation.ok)
            return fail(reservation.error, reservation.error === "deployment_quota_exhausted" ? 429 : 409);
        if (reservation.reused && reservation.reservation.status === "reserved")
            return fail("deployment_outcome_unknown");
        if (reservation.reused)
            return { status: 200, body: { ok: true as const, data: { releaseId, status: release.status, dispatched: true, replayed: true, execution: serializeDeploymentExecution(reservation.reservation), evidence: deploymentEvidence("service_restart") } } };
        reservationId = reservation.reservation.id;
        claimedAt = deps.now();
        initialReleaseSnapshot = { updatedAt: release.updatedAt, actualDeployStart: release.actualDeployStart };
        // Fresh authority and exact source/target/readiness snapshot after GitHub IO.
        claimUpdatedAt = await repo.$transaction(async (tx) => {
            if (!await membership(tx, organizationId, userId))
                throw new Error("restart_authority_changed");
            const [current, repoNow, envNow, targetNow, snapshotNow, policiesNow, installationNow] = await Promise.all([
                tx.release.findUnique({ where: { id: releaseId } }), tx.repository.findUnique({ where: { id: repository.id } }), tx.environment.findUnique({ where: { id: environment.id } }), tx.deploymentTarget.findUnique({ where: { environmentId: environment.id } }), tx.releaseReadinessSnapshot.findFirst({ where: { organizationId, releaseId }, orderBy: { evaluatedAt: "desc" } }), tx.branchEnvironmentPolicy.findMany(policyQuery), tx.gitHubInstallation.findFirst(installationQuery),
            ]);
            if (!installationNow || JSON.stringify(installationNow) !== JSON.stringify(installation) || policyFingerprint(policiesNow) !== policyFingerprint(policySnapshot) || !current || current.updatedAt.getTime() !== release.updatedAt.getTime() || current.status !== "ready" || !repoNow || repoNow.updatedAt.getTime() !== repository.updatedAt.getTime() || !envNow || envNow.updatedAt.getTime() !== environment.updatedAt.getTime() || !targetNow || targetNow.updatedAt.getTime() !== target.updatedAt.getTime() || snapshotNow?.id !== readiness.id || await tx.policyViolation.count({ where: { organizationId, releaseId, status: { not: "resolved" }, rule: { blocking: true } } }))
                throw new Error("restart_snapshot_changed");
            const transition = applyTransition(current.status as ReleaseStatus, "start_deploy", { actorUserId: userId, now: claimedAt! });
            if (!transition.ok)
                throw new Error("illegal_transition");
            const changed = await tx.release.updateMany({ where: { id: releaseId, organizationId, status: "ready", updatedAt: release.updatedAt }, data: { status: transition.next, ...transition.fieldsToSet } });
            if (changed.count !== 1)
                throw new Error("restart_snapshot_changed");
            const claimed = await tx.release.findUnique({ where: { id: releaseId } });
            if (!claimed)
                throw new Error("restart_snapshot_changed");
            return claimed.updatedAt;
        }, { isolationLevel: "Serializable" });
        claimCommitted = true;
        // Once provider invocation begins, any exception is an uncertain outcome.
        let result;
        providerInvoked = true;
        try {
            result = await deps.dispatch({ owner: repository.remoteOwner, repo: repository.remoteName, workflowFile: AWS_ECS_DEPLOY_WORKFLOW_FILENAME, ref: release.releaseTag, inputs: { role_arn: target.roleArn, region: target.region, cluster: target.ecsCluster, service: target.ecsService }, installationToken: token.token });
        }
        catch {
            return fail("deployment_outcome_unknown", 502);
        }
        if (!result.ok) {
            if (!isDefiniteWorkflowDispatchRejection(result.error))
                return fail("deployment_outcome_unknown", 502);
            // Revert only this claim. Never restore over a later operator transition.
            const restored = await repo.release.updateMany({ where: { id: releaseId, organizationId, status: "deploying", actualDeployStart: claimedAt, updatedAt: claimUpdatedAt }, data: { status: "ready", actualDeployStart: release.actualDeployStart } });
            if (restored.count === 1)
                await deps.release(repo as unknown as DeploymentReservationRepo, organizationId, reservationId);
            return fail(restored.count === 1 ? "dispatch_failed" : "deployment_outcome_unknown", 502);
        }
        try {
            await (deps.audit ?? appendAuditEvent)(repo as unknown as AuditEventRepo, { organizationId, kind: "release.deploy_triggered", subjectKind: "release", subjectId: releaseId, actorUserId: userId, outcome: "ok", summary: "Configured ECS restart workflow accepted; source artifact, application health and image rollback remain unverified.", detailJson: { deploymentExecutionId: reservationId, workflowRunId: result.data.workflowRunId, requestedOperation: "service_restart" } });
        }
        catch { /* accepted provider action is preserved if secondary audit storage fails */ }
        const settled = await deps.settle(repo as unknown as DeploymentReservationRepo, organizationId, reservationId, { workflowRunId: result.data.workflowRunId, workflowUrl: result.data.htmlUrl });
        return { status: settled ? 200 : 207, body: { ok: true as const, data: { releaseId, status: "deploying", dispatched: true, trackingAvailable: settled && Boolean(result.data.workflowRunId), workflowUrl: result.data.htmlUrl, evidence: deploymentEvidence("service_restart") } } };
    }
    catch {
        if (providerInvoked || claimCommitted)
            return fail("deployment_outcome_unknown", 502);
        // A thrown transaction can represent an unknown commit outcome. Release a
        // reservation only after an authoritative read proves our claim absent.
        if (reservationId && initialReleaseSnapshot) {
            try {
                const current = await repo.release.findUnique({ where: { id: releaseId } });
                const originalStart = initialReleaseSnapshot.actualDeployStart?.getTime() ?? null;
                if (!current || current.organizationId !== organizationId || current.status !== "ready" || current.updatedAt.getTime() !== initialReleaseSnapshot.updatedAt.getTime() || (current.actualDeployStart?.getTime() ?? null) !== originalStart)
                    return fail("deployment_outcome_unknown", 502);
                const released = await deps.release(repo as unknown as DeploymentReservationRepo, organizationId, reservationId);
                if (!released)
                    return fail("deployment_outcome_unknown", 502);
            }
            catch {
                return fail("deployment_outcome_unknown", 502);
            }
        }
        return fail("restart_unavailable", 503);
    }
}
