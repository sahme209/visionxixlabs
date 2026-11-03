import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { assertScope, normalizeScopes } from '@/lib/security/apiKeyScope';
import { isApproverRole } from '@/lib/auth/platformAdmin';
import { hasPermission } from '@/lib/axiom/agent/rbacEngine';
import type { OrgRole } from '@/lib/axiom/enums';
import { sha256ContentHash as hash } from '@/lib/tauri/contentHash';
import { readEnrollmentDrainBarrierLocked } from '@/lib/governance/intelligence/enrollmentDrainStore';
import { assertNoGovernanceEnrollmentForMutation } from '@/lib/governance/intelligence/enrollmentMetadata';
import { loadApprovedCodingArtifact } from './approvedCodingArtifact';
import { readCodingOutboundIssuerDigest } from './codingOutboundIssuer';
import { CODING_PARENT, codingParentId, workerSchema, validateCodingRow, deny, parentInputSchema, parentStateSchema } from './codingOutboundHistory';
import type { ReleaseOperationPlanTransaction as Tx, ReleaseOperationPlanRow as Row } from '@/lib/agent/workflows/releaseOperationPlanStore';
export interface CodingStageClaim {
    readonly parentId: string;
}
type Repo = Pick<PrismaClient, '$transaction' | 'pipelineRun' | 'pipelineStageRun' | 'orgMembership' | 'gitHubInstallation' | 'durableAgentWorkflow' | 'durableAgentWorkflowEvent' | 'apiKey'>;
const privateClaims = new WeakMap<CodingStageClaim, {
    worker: ReturnType<typeof workerSchema.parse>;
    input: ReturnType<typeof parentInputSchema.parse>;
    source: unknown;
    started: number;
    deadline: number;
}>();
export async function appendCodingEvent(tx: Tx, row: Row, previous: unknown) {
    await tx.durableAgentWorkflowEvent.create({ data: { organizationId: row.organizationId, workflowRunId: row.id, sequence: row.version, eventType: row.workflowKind + '.' + row.currentStep, actorKind: 'system', actorId: row.requestedByUserId, occurredAt: row.updatedAt, detailJson: { inputDigest: hash(row.inputJson), stateDigest: hash(row.stateJson), previousStateDigest: previous === null ? null : hash(previous), state: row.stateJson } } });
}
export async function codingDbClock(tx: Tx) {
    const [r] = await tx.$queryRaw<Array<{
        now: Date;
    }>> `SELECT clock_timestamp() AS "now"`;
    if (!r || !(r.now instanceof Date) || !Number.isFinite(r.now.getTime()))
        deny();
    return r.now;
}
async function source(tx: Prisma.TransactionClient, organizationId: string, runId: string, stageId: string) {
    await tx.$queryRaw `SELECT r."id" FROM "PipelineRun" r JOIN "PipelineStageRun" s ON s."runId"=r."id" WHERE r."id"=${runId} AND r."organizationId"=${organizationId} FOR SHARE OF r,s`;
    const run = await tx.pipelineRun.findUnique({ where: { id: runId } }), stage = await tx.pipelineStageRun.findUnique({ where: { id: stageId } });
    if (!run || run.organizationId !== organizationId || run.pipelineId !== 'ai_coding' || run.status !== 'running' || !stage || stage.runId !== runId || stage.stageKind !== 'code_pr_open')
        deny();
    await tx.$queryRaw `SELECT a."id",d."id" FROM "EngineerApprovalSnapshot" a JOIN "PipelineStageRun" s ON s."id"=a."pipelineStageRunId" JOIN "EngineerApprovalDecision" d ON d."snapshotId"=a."id" WHERE s."runId"=${runId} AND a."organizationId"=${organizationId} FOR SHARE OF a,d`;
    await tx.$queryRaw `SELECT "userId" FROM "OrgMembership" WHERE "organizationId"=${organizationId} FOR SHARE`;
    await tx.$queryRaw `SELECT "id" FROM "GitHubInstallation" WHERE "organizationId"=${organizationId} FOR SHARE`;
    await tx.$queryRaw `SELECT "id" FROM "ApiKey" WHERE "organizationId"=${organizationId} FOR SHARE`;
    const checked = await loadApprovedCodingArtifact({ organizationId, runId, actorUserId: run!.triggeredBy }, tx);
    if (!checked.ok)
        deny();
    const artifact = checked.ok ? checked.artifact : deny();
    const read = await tx.pipelineStageRun.findUnique({ where: { id: artifact.readStageRunId } }), proposal = await tx.pipelineStageRun.findUnique({ where: { id: artifact.proposalStageRunId } });
    const observed = read?.outputDetail as Record<string, unknown> | null, proposed = proposal?.outputDetail as Record<string, unknown> | null;
    if (!read || read.runId !== runId || read.stageKind !== 'code_read' || read.status !== 'succeeded' || !proposal || proposal.runId !== runId || proposal.stageKind !== 'code_propose' || proposal.status !== 'succeeded' || proposed?.proposedPatchText !== artifact.patchText || observed?.branch !== artifact.baseBranch || observed?.headSha !== artifact.baseCommitSha || observed?.owner + '/' + observed?.repo !== artifact.repositoryFullName)
        deny();
    const gate = await tx.pipelineStageRun.findFirst({ where: { runId, stageId: 'code_gate', status: 'succeeded' }, include: { approvals: { include: { decisions: true } } } });
    const approved = gate?.approvals.find(a => a.approvalRequestId === gate.approvalRequestId);
    if (!approved)
        deny();
    let voterExpiresAt = Number.POSITIVE_INFINITY;
    const authorityAt = await codingDbClock(tx as unknown as Tx);
    for (const vote of approved!.decisions) {
        if (vote.approverUserId.startsWith('api_key:')) {
            const key = await tx.apiKey.findUnique({ where: { id: vote.approverUserId.slice(8) } });
            if (!key || key.organizationId !== organizationId || key.revokedAt || key.expiresAt !== null && (!(key.expiresAt instanceof Date) || !Number.isFinite(key.expiresAt.getTime()) || key.expiresAt <= authorityAt) || !Array.isArray(key.scopes) || !assertScope('pipeline:trigger', normalizeScopes(key.scopes)).allowed)
                deny();
            if (key!.expiresAt)
                voterExpiresAt = Math.min(voterExpiresAt, key!.expiresAt.getTime());
        }
        else {
            const member = await tx.orgMembership.findUnique({ where: { userId_organizationId: { userId: vote.approverUserId, organizationId } } });
            if (!member?.acceptedAt || !isApproverRole([member.role]))
                deny();
        }
    }
    const installation = await tx.gitHubInstallation.findFirst({ where: { organizationId, status: 'active' }, orderBy: { installedAt: 'desc' } });
    if (!installation || installation.revokedAt || installation.suspendedAt || !/^[1-9][0-9]*$/.test(installation.githubInstallationId))
        deny();
    return { run: run!, stage: stage!, artifact: checked.ok ? checked.artifact : deny(), artifactDigest: checked.ok ? checked.digest : deny(), installation: { id: installation!.id, githubInstallationId: installation!.githubInstallationId, updatedAt: installation!.updatedAt.toISOString() }, votes: approved!.decisions.map(v => ({ id: v.id, actor: v.approverUserId, decision: v.decision })).sort((a, b) => a.id.localeCompare(b.id)), gateId: gate!.id, approval: { id: approved!.id, approvalRequestId: approved!.approvalRequestId, action: approved!.action, status: approved!.status, effectiveRule: approved!.effectiveRule, requiredApprovers: approved!.requiredApprovers, requestedBy: approved!.requestedBy }, readDigest: hash(read!.outputDetail), proposalDigest: hash(proposal!.outputDetail), voterExpiresAt };
}
const pin = (s: Awaited<ReturnType<typeof source>>) => ({ organizationId: s.run.organizationId, runId: s.run.id, actor: s.run.triggeredBy, metadata: s.run.metadata, correlationId: s.run.correlationId, stageId: s.stage.id, artifactDigest: s.artifactDigest, installation: s.installation, votes: s.votes, gateId: s.gateId, approval: s.approval, readDigest: s.readDigest, proposalDigest: s.proposalDigest });
export async function claimCodingStage(repo: Repo, organizationId: string, runId: string, stageId: string): Promise<CodingStageClaim | null> {
    const issuer = readCodingOutboundIssuerDigest();
    const signal = AbortSignal.timeout(15000), started = Date.now();
    let context: typeof privateClaims extends WeakMap<any, infer T> ? T : never;
    const id = await repo.$transaction(async (raw) => {
        const tx = raw as unknown as Tx;
        await tx.$queryRaw `SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_' + hash(organizationId)}))`;
        await assertNoGovernanceEnrollmentForMutation(raw, organizationId, signal);
        const bar = await readEnrollmentDrainBarrierLocked(tx, organizationId, signal);
        if (bar && bar.status !== 'aborted')
            deny();
        const s = await source(raw, organizationId, runId, stageId);
        if (s.stage.status !== 'queued')
            return null;
        const at = await codingDbClock(tx), worker = workerSchema.parse({ kind: 'coding_stage', organizationId, actorUserId: s.run.triggeredBy, runId, stageRunId: stageId, nonce: randomUUID() }), input = parentInputSchema.parse({ format: 1, worker, artifactDigest: s.artifactDigest, sourceDigest: hash(pin(s)), installation: s.installation, issuerDigest: issuer, claimedAt: at.toISOString(), expiresAt: new Date(Math.min(at.getTime() + 600000, s.voterExpiresAt)).toISOString() });
        const changed = await raw.pipelineStageRun.updateMany({ where: { id: stageId, runId, status: 'queued' }, data: { status: 'running', startedAt: at } });
        if (changed.count !== 1)
            return null;
        const parentId = codingParentId(worker), state = { phase: 'claimed', base: null, providerExpiresAt: null };
        const row = await tx.durableAgentWorkflow.create({ data: { id: parentId, organizationId, workflowKind: CODING_PARENT, objective: 'Coding stage exposure metadata; no independent execution authority', requestedByUserId: worker.actorUserId, autonomyLevel: 'observe', status: 'paused_for_input', currentStep: 'claimed', inputJson: input, stateJson: state, attemptCount: 1, maxAttempts: 1, version: 0, leaseOwner: null, leaseExpiresAt: null, approvalProposalId: null, createdAt: at, updatedAt: at } });
        await appendCodingEvent(tx, row, null);
        context = { worker, input, source: pin(s), started, deadline: started + Math.min(600000, Date.parse(input.expiresAt) - at.getTime()) };
        return parentId;
    });
    if (!id)
        return null;
    signal.throwIfAborted();
    if (readCodingOutboundIssuerDigest() !== issuer)
        deny();
    const proof = Object.freeze({ parentId: id });
    privateClaims.set(proof, context!);
    return proof;
}
export async function readCodingClaimLocked(tx: Prisma.TransactionClient, proof: CodingStageClaim, signal: AbortSignal) {
    const c = privateClaims.get(proof);
    if (!c)
        deny();
    const context = c!, wall = Date.now(), monotonic = performance.now();
    const ready = () => {
        signal.throwIfAborted();
        const now = Date.now();
        if (privateClaims.get(proof) !== context || !Number.isFinite(now) || now < context.started || now >= context.deadline || readCodingOutboundIssuerDigest() !== context.input.issuerDigest)
            deny();
    };
    ready();
    await tx.$queryRaw `SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_' + hash(context.worker.organizationId)}))`;
    await assertNoGovernanceEnrollmentForMutation(tx, context.worker.organizationId, signal);
    const s = await source(tx, context.worker.organizationId, context.worker.runId, context.worker.stageRunId);
    if (s.stage.status !== 'running' || s.stage.startedAt?.toISOString() !== context.input.claimedAt || hash(pin(s)) !== context.input.sourceDigest)
        deny();
    const row = await tx.durableAgentWorkflow.findFirst({ where: { id: proof.parentId, organizationId: context.worker.organizationId } });
    if (!row)
        deny();
    await validateCodingRow(tx as unknown as Tx, row!);
    if (hash(row!.inputJson) !== hash(context.input))
        deny();
    const at = await codingDbClock(tx as unknown as Tx);
    const remaining = Math.min(Date.parse(context.input.expiresAt), s.voterExpiresAt) - at.getTime();
    if (!Number.isFinite(remaining) || remaining <= 0)
        deny();
    const fresh = () => {
        ready();
        const elapsed = Date.now() - wall, elapsedMono = performance.now() - monotonic;
        if (!Number.isFinite(elapsed) || !Number.isFinite(elapsedMono) || elapsed < 0 || elapsedMono < 0 || Math.max(elapsed, elapsedMono) >= remaining)
            deny();
    };
    fresh();
    return { context, source: s, row: row!, state: parentStateSchema.parse(row!.stateJson), fresh };
}
export function codingClaimWorker(proof: CodingStageClaim) {
    const c = privateClaims.get(proof);
    if (!c)
        deny();
    return structuredClone(c!.worker);
}
