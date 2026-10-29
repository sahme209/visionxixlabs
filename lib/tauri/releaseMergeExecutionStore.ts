import 'server-only';
import { z } from 'zod';
import { sha256ContentHash } from './contentHash';
import { buildReleaseMergePlan } from './releaseMergePlan';
import { parseReleaseOperationPlanInput } from './releaseOperationPlanContract';
import { RELEASE_MERGE_EXECUTION_KIND } from './releaseMergeExecutionKind';
import { releaseOperationPlanId, type ReleaseOperationPlanRepo, type ReleaseOperationPlanTransaction, type ReleaseOperationPlanRow } from '@/lib/agent/workflows/releaseOperationPlanStore';
const id = z.string().min(1).max(240).refine(v => v === v.trim() && !/[\x00-\x1f\x7f]/.test(v));
const hash = z.string().regex(/^[a-f0-9]{64}$/), instant = z.string().datetime();
const scopeSchema = z.object({ organizationId: id, actorUserId: id, sessionId: id }).strict();
export type MergeExecutionScope = z.infer<typeof scopeSchema>;
const approvalSchema = z.object({ kind: z.literal('verified_release_merge_execution_approval_v1'), id, organizationId: id, planId: id, planDigest: hash, executorUserId: id, approverUserId: id, expiresAt: instant }).strict();
export type ExecutableMergeApproval = z.infer<typeof approvalSchema>;
const bindingSchema = z.object({ format: z.literal(1), simulationOnly: z.literal(true), scope: scopeSchema, planId: id, planVersion: z.literal(1), planInput: z.unknown(), creatorUserId: id, requesterUserId: id, approval: approvalSchema }).strict();
type Binding = z.infer<typeof bindingSchema>;
export type MergeExecutionState = 'prepared' | 'dispatching' | 'unknown' | 'simulated_confirmed' | 'simulated_refused' | 'cancelled';
const stateSchema = z.object({ state: z.enum(['prepared', 'dispatching', 'unknown', 'simulated_confirmed', 'simulated_refused', 'cancelled']), mergeSha: z.string().regex(/^[a-f0-9]{40}$/).optional() }).strict();
/** Internal verifier ports, not authentication implementations. No production adapter exists.
 * assertCurrent must freshly verify paired session, commercial access, executor and
 * independent approver capabilities. readExecutableApproval must read a genuine
 * separately authorized exact approval; advisory release-plan reviews are insufficient.
 */
export interface MergeExecutionDependencies {
    assertCurrent?: (tx: ReleaseOperationPlanTransaction, scope: MergeExecutionScope, binding?: Readonly<Binding>) => Promise<void>;
    readExecutableApproval?: (tx: ReleaseOperationPlanTransaction, scope: MergeExecutionScope, planId: string, executionId?: string) => Promise<unknown>;
    consumeExecutableApproval?: (tx: ReleaseOperationPlanTransaction, scope: MergeExecutionScope, approvalId: string, executionId: string) => Promise<void>;
    now?: () => Date;
}
export class MergeExecutionUnavailable extends Error {
    constructor(readonly code = 'merge_execution_unavailable') { super(code); this.name = 'MergeExecutionUnavailable'; }
}
const refuse = (code?: string): never => { throw new MergeExecutionUnavailable(code); };
function planInput(binding: Binding) { return parseReleaseOperationPlanInput(binding.planInput); }
function snapshot(row: ReleaseOperationPlanRow) {
    const binding = bindingSchema.parse(row.inputJson), p = planInput(binding), state = stateSchema.parse(row.stateJson);
    if (row.organizationId !== binding.scope.organizationId || row.workflowKind !== RELEASE_MERGE_EXECUTION_KIND || row.id !== executionId(binding) || row.requestedByUserId !== binding.scope.actorUserId || row.maxAttempts !== 1 || row.approvalProposalId !== null || sha256ContentHash(p.plan) !== p.planDigest || p.plan.organizationId !== binding.scope.organizationId || p.releaseRequesterUserId !== binding.requesterUserId || p.planDigest !== binding.approval.planDigest)
        refuse();
    const expected = state.state === 'prepared' ? { attempt: 0, status: 'paused_for_input', version: 0 } : state.state === 'cancelled' ? { attempt: 0, status: 'cancelled', version: 1 } : state.state === 'dispatching' ? { attempt: 1, status: 'running', version: 1 } : { attempt: 1, status: state.state === 'unknown' ? 'paused_for_input' : 'completed', version: 2 };
    if (row.attemptCount !== expected.attempt || row.version !== expected.version || row.status !== expected.status || row.currentStep !== state.state || Boolean(row.leaseOwner) !== (state.state === 'dispatching') || Boolean(row.leaseExpiresAt) !== (state.state === 'dispatching'))
        refuse();
    return { binding, state: state.state, mergeSha: state.mergeSha };
}
function executionId(binding: Binding) { return 'release_merge_sim_' + sha256ContentHash({ organizationId: binding.scope.organizationId, planId: binding.planId }); }
function dto(row: ReleaseOperationPlanRow) { const s = snapshot(row); return { id: row.id, state: s.state, attemptCount: row.attemptCount, version: row.version, simulationOnly: true as const, executionAuthorized: false as const, providerWritePerformed: false as const, ...(s.mergeSha ? { mergeSha: s.mergeSha } : {}) }; }
export type MergeExecutionDto = ReturnType<typeof dto>;
export function createReleaseMergeExecutionStore(repo: ReleaseOperationPlanRepo, deps: MergeExecutionDependencies) {
    const now = () => { const d = new Date((deps.now?.() ?? new Date()).getTime()); if (!Number.isFinite(d.getTime()))
        refuse(); return d; };
    async function authority(tx: ReleaseOperationPlanTransaction, scope: MergeExecutionScope, binding?: Binding) { const verify = deps.assertCurrent; if (typeof verify !== 'function')
        return refuse('authority_unavailable'); await verify(tx, scope, binding ? structuredClone(binding) : undefined); }
    async function approval(tx: ReleaseOperationPlanTransaction, scope: MergeExecutionScope, planId: string, executionId?: string) { const read = deps.readExecutableApproval; if (typeof read !== 'function')
        return refuse('approval_unavailable'); return approvalSchema.parse(await read(tx, scope, planId, executionId)); }
    async function load(tx: ReleaseOperationPlanTransaction, scope: MergeExecutionScope, execution: string) {
        if (!/^release_merge_sim_[a-f0-9]{64}$/.test(execution))
            refuse();
        const rows = await tx.$queryRaw<ReleaseOperationPlanRow[]> `SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${execution} AND "organizationId"=${scope.organizationId} AND "workflowKind"=${RELEASE_MERGE_EXECUTION_KIND} FOR UPDATE`;
        if (rows.length !== 1)
            refuse();
        const row = rows[0], s = snapshot(row);
        if (sha256ContentHash(s.binding.scope) !== sha256ContentHash(scope))
            refuse();
        const events = await tx.durableAgentWorkflowEvent.findMany({ where: { workflowRunId: row.id, organizationId: scope.organizationId }, orderBy: { sequence: 'asc' }, take: 4 });
        if (events.length !== row.version + 1 || events.some((e, i) => e.workflowRunId !== row.id || e.organizationId !== scope.organizationId || e.sequence !== i || e.eventType !== 'release_merge_sim.' + (i === 0 ? 'prepared' : i === 1 && s.state !== 'cancelled' ? 'dispatching' : s.state) || e.actorId !== scope.actorUserId || !Number.isFinite(e.occurredAt.getTime())))
            refuse();
        return row;
    }
    async function event(tx: ReleaseOperationPlanTransaction, row: ReleaseOperationPlanRow, state: MergeExecutionState) { await tx.durableAgentWorkflowEvent.create({ data: { workflowRunId: row.id, organizationId: row.organizationId, sequence: row.version, eventType: 'release_merge_sim.' + state, actorKind: 'user', actorId: row.requestedByUserId, detailJson: { simulationOnly: true, executionAuthorized: false }, occurredAt: now() } }); }
    async function live(tx: ReleaseOperationPlanTransaction, binding: Binding, lease?: Date) { const p = planInput(binding), deadline = new Date(Math.min(Date.parse(p.deadlineAt), Date.parse(binding.approval.expiresAt), lease?.getTime() ?? Infinity)); const start = new Date(p.plan.window.startUtc); if (now() < start || now() >= deadline)
        refuse(); const rows = await tx.$queryRaw<Array<{
        live: boolean;
    }>> `SELECT clock_timestamp() < ${deadline} AND clock_timestamp() >= ${start} AS "live"`; if (rows.length !== 1 || rows[0].live !== true)
        refuse(); }
    async function current(tx: ReleaseOperationPlanTransaction, scope: MergeExecutionScope, binding: Binding) {
        const p = planInput(binding), plan = p.plan;
        const plans = await tx.$queryRaw<ReleaseOperationPlanRow[]> `SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${binding.planId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
        const stored = plans[0];
        if (plans.length !== 1 || !stored || stored.workflowKind !== 'release_operation_plan_v1' || stored.version !== binding.planVersion || stored.requestedByUserId !== binding.creatorUserId || stored.status !== 'completed' || stored.currentStep !== 'reviewed' || sha256ContentHash(stored.inputJson) !== sha256ContentHash(binding.planInput) || stored.attemptCount !== 0 || stored.maxAttempts !== 1 || stored.leaseOwner || stored.leaseExpiresAt || stored.approvalProposalId)
            refuse();
        const histories = await tx.durableAgentWorkflowEvent.findMany({ where: { workflowRunId: stored.id, organizationId: scope.organizationId }, orderBy: { sequence: 'asc' }, take: 3 });
        if (histories.length !== 2 || histories.some((e, i) => e.workflowRunId !== stored.id || e.organizationId !== scope.organizationId || e.sequence !== i || e.eventType !== (i ? 'release_plan.reviewed' : 'release_plan.created') || !Number.isFinite(e.occurredAt.getTime())) || histories[0].actorId !== binding.creatorUserId || !histories[1].actorId || [binding.creatorUserId, binding.requesterUserId].includes(histories[1].actorId))
            refuse();
        const releases = await tx.$queryRaw<Array<{
            id: string;
            organizationId: string;
            requesterUserId: string;
            version: number;
            status: string;
            intakeJson: unknown;
        }>> `SELECT "id","organizationId","requesterUserId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${plan.requestId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
        const connections = await tx.$queryRaw<Array<{
            id: string;
            organizationId: string;
            status: string;
            updatedAt: Date;
            githubInstallationId: string;
            revokedAt: Date | null;
            suspendedAt: Date | null;
        }>> `SELECT "id","organizationId","status","updatedAt","githubInstallationId","revokedAt","suspendedAt" FROM "GitHubInstallation" WHERE "id"=${plan.connectionId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
        const release = releases[0], connection = connections[0];
        if (releases.length !== 1 || connections.length !== 1 || release.requesterUserId !== binding.requesterUserId || connection.id !== plan.connectionId || connection.organizationId !== scope.organizationId || connection.status !== 'active' || connection.revokedAt || connection.suspendedAt || connection.updatedAt.getTime() !== Date.parse(plan.connectionRevision) || !/^[1-9][0-9]*$/.test(connection.githubInstallationId))
            refuse();
        const built = buildReleaseMergePlan(release, { organizationId: scope.organizationId, requestId: plan.requestId, expectedVersion: plan.requestVersion, expectedDigest: plan.intakeDigest, method: plan.method, observation: { connectionId: plan.connectionId, connectionRevision: plan.connectionRevision, repositoryFullName: plan.pullRequest.repositoryFullName, number: plan.pullRequest.number, headRepositoryFullName: plan.pullRequest.repositoryFullName, headRef: plan.pullRequest.headRef, headSha: plan.pullRequest.headSha, baseRef: plan.pullRequest.baseRef, baseSha: plan.pullRequest.baseSha, state: 'open', draft: false, merged: false } });
        if (!built.ok || built.digest !== p.planDigest)
            refuse();
        const a = await approval(tx, scope, binding.planId, executionId(binding));
        if (sha256ContentHash(a) !== sha256ContentHash(binding.approval))
            refuse('approval_unavailable');
        if (a.organizationId !== scope.organizationId || a.planId !== binding.planId || a.planDigest !== p.planDigest || a.executorUserId !== scope.actorUserId || [binding.creatorUserId, binding.requesterUserId, scope.actorUserId].includes(a.approverUserId))
            refuse('approval_unavailable');
        for (const user of new Set([scope.actorUserId, binding.creatorUserId, binding.requesterUserId, a.approverUserId])) {
            const memberships = await tx.$queryRaw<Array<{
                organizationId: string;
                userId: string;
                acceptedAt: Date | null;
            }>> `SELECT "organizationId","userId","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${user} FOR SHARE`;
            if (memberships.length !== 1 || memberships[0].organizationId !== scope.organizationId || memberships[0].userId !== user || !memberships[0].acceptedAt)
                refuse();
        }
        await authority(tx, scope, binding);
        await live(tx, binding);
    }
    async function change(tx: ReleaseOperationPlanTransaction, row: ReleaseOperationPlanRow, state: MergeExecutionState, extra: Record<string, unknown> = {}) { const data = { status: state === 'dispatching' ? 'running' : state === 'cancelled' ? 'cancelled' : ['unknown', 'prepared'].includes(state) ? 'paused_for_input' : 'completed', currentStep: state, stateJson: { state, ...('mergeSha' in extra ? { mergeSha: extra.mergeSha } : {}) }, version: { increment: 1 }, updatedAt: now(), ...extra }; delete (data as Record<string, unknown>).mergeSha; const result = await tx.durableAgentWorkflow.updateMany({ where: { id: row.id, organizationId: row.organizationId, workflowKind: RELEASE_MERGE_EXECUTION_KIND, version: row.version, status: row.status, currentStep: row.currentStep, attemptCount: row.attemptCount, inputJson: { equals: row.inputJson } }, data }); if (result.count !== 1)
        refuse(); const updated = { ...row, ...data, version: row.version + 1 } as ReleaseOperationPlanRow; await event(tx, updated, state); return updated; }
    return {
        async prepare(rawScope: MergeExecutionScope, planId: string) { const scope = scopeSchema.parse(rawScope); if (!deps.readExecutableApproval)
            refuse('approval_unavailable'); return repo.$transaction(async (tx) => { await authority(tx, scope); const plans = await tx.$queryRaw<ReleaseOperationPlanRow[]> `SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${planId} AND "organizationId"=${scope.organizationId} FOR SHARE`; if (plans.length !== 1)
            refuse(); const row = plans[0], p = parseReleaseOperationPlanInput(row.inputJson); if (row.id !== releaseOperationPlanId(scope.organizationId, p.plan.requestId, p.plan.requestVersion, p.planDigest))
            refuse(); const a = await approval(tx, scope, planId, 'release_merge_sim_' + sha256ContentHash({ organizationId: scope.organizationId, planId })); const binding = bindingSchema.parse({ format: 1, simulationOnly: true, scope, planId, planVersion: 1, planInput: p, creatorUserId: row.requestedByUserId, requesterUserId: p.releaseRequesterUserId, approval: a }); await current(tx, scope, binding); const execution = executionId(binding), existing = await tx.durableAgentWorkflow.findFirst({ where: { id: execution, organizationId: scope.organizationId, workflowKind: RELEASE_MERGE_EXECUTION_KIND } }); if (existing) {
            const previous = await load(tx, scope, execution);
            if (sha256ContentHash(previous.inputJson) !== sha256ContentHash(binding))
                refuse();
            await authority(tx, scope, binding);
            await live(tx, binding);
            return dto(previous);
        } const at = now(); const saved = await tx.durableAgentWorkflow.create({ data: { id: execution, organizationId: scope.organizationId, workflowKind: RELEASE_MERGE_EXECUTION_KIND, objective: 'Simulate exact merge safety core; provider execution unavailable', status: 'paused_for_input', autonomyLevel: 'observe', currentStep: 'prepared', inputJson: binding, stateJson: { state: 'prepared' }, requestedByUserId: scope.actorUserId, attemptCount: 0, maxAttempts: 1, version: 0, leaseOwner: null, leaseExpiresAt: null, approvalProposalId: null, nextAttemptAt: null, createdAt: at, updatedAt: at } }); await event(tx, saved, 'prepared'); await authority(tx, scope, binding); await live(tx, binding); return dto(saved); }); },
        async claim(rawScope: MergeExecutionScope, execution: string) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); await authority(tx, scope, s.binding); if (s.state !== 'prepared')
            return { claimed: false as const, record: dto(row) }; await current(tx, scope, s.binding); if (typeof deps.consumeExecutableApproval !== 'function') refuse('approval_consumption_unavailable'); await deps.consumeExecutableApproval!(tx, scope, s.binding.approval.id, row.id); const lease = new Date(Math.min(now().getTime() + 30000, Date.parse(planInput(s.binding).deadlineAt), Date.parse(s.binding.approval.expiresAt))); const updated = await change(tx, row, 'dispatching', { attemptCount: 1, leaseOwner: row.id, leaseExpiresAt: lease }); await authority(tx, scope, s.binding); await live(tx, s.binding, lease); return { claimed: true as const, record: dto(updated), binding: structuredClone(s.binding), leaseExpiresAt: lease }; }); },
        async beforeDispatch(rawScope: MergeExecutionScope, execution: string) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); if (s.state !== 'dispatching')
            refuse(); await current(tx, scope, s.binding); await live(tx, s.binding, row.leaseExpiresAt!); return structuredClone(planInput(s.binding).plan); }); },
        async finish(rawScope: MergeExecutionScope, execution: string, result: {
            state: 'unknown' | 'simulated_confirmed' | 'simulated_refused';
            mergeSha?: string;
        }) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); if (s.state !== 'dispatching')
            return dto(row); const final = z.object({ state: z.enum(['unknown', 'simulated_confirmed', 'simulated_refused']), mergeSha: z.string().regex(/^[a-f0-9]{40}$/).optional() }).strict().refine(v => (v.state === 'simulated_confirmed') === (v.mergeSha !== undefined)).parse(result); if (final.state !== 'unknown') {
            await current(tx, scope, s.binding);
            await live(tx, s.binding, row.leaseExpiresAt!);
        } const updated = await change(tx, row, final.state, { leaseOwner: null, leaseExpiresAt: null, ...(final.mergeSha ? { mergeSha: final.mergeSha } : {}) }); if (final.state !== 'unknown') {
            await authority(tx, scope, s.binding);
            await live(tx, s.binding, row.leaseExpiresAt!);
        } return dto(updated); }); },
        async recover(rawScope: MergeExecutionScope, execution: string) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); await authority(tx, scope, s.binding); if (s.state === 'dispatching' && row.leaseExpiresAt!.getTime() <= now().getTime())
            return dto(await change(tx, row, 'unknown', { leaseOwner: null, leaseExpiresAt: null })); return dto(row); }); },
        async cancel(rawScope: MergeExecutionScope, execution: string) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); await authority(tx, scope, s.binding); if (s.state !== 'prepared')
            return dto(row); const updated = await change(tx, row, 'cancelled'); await authority(tx, scope, s.binding); return dto(updated); }); },
    };
}
export type ReleaseMergeExecutionStore = ReturnType<typeof createReleaseMergeExecutionStore>;
