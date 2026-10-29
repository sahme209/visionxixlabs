import 'server-only';
import {releaseProviderMergeReceiptSchema,parseReleaseProviderMergeDto,type ProviderMergeReceipt} from './releaseProviderMergeContract';
import { z } from 'zod';
import { sha256ContentHash } from './contentHash';
import { buildReleaseMergePlan } from './releaseMergePlan';
import { parseReleaseOperationPlanInput } from './releaseOperationPlanContract';
import { RELEASE_PROVIDER_MERGE_KIND } from './releaseProviderMergeKind';
import { releaseOperationPlanId, type ReleaseOperationPlanRepo, type ReleaseOperationPlanTransaction, type ReleaseOperationPlanRow } from '@/lib/agent/workflows/releaseOperationPlanStore';
const id = z.string().min(1).max(240).refine(v => v === v.trim() && !/[\x00-\x1f\x7f]/.test(v));
const hash = z.string().regex(/^[a-f0-9]{64}$/), instant = z.string().datetime();
const scopeSchema = z.object({ organizationId: id, actorUserId: id, sessionId: id }).strict();
export type ProviderMergeScope = z.infer<typeof scopeSchema>;
const approvalSchema = z.object({ kind: z.literal('verified_release_provider_merge_approval_v1'), id, organizationId: id, planId: id, planDigest: hash, executorUserId: id, approverUserId: id, expiresAt: instant,sourcePolicy:z.literal('expected_head_observed_base') }).strict();
export type ProviderMergeApproval = z.infer<typeof approvalSchema>;
const bindingSchema = z.object({ format: z.literal(1), mode:z.literal('provider'), scope: scopeSchema, planId: id, planVersion: z.literal(1), planInput: z.unknown(), creatorUserId: id, requesterUserId: id, approval: approvalSchema }).strict();
type Binding = z.infer<typeof bindingSchema>;
export type ProviderMergeState = 'prepared' | 'dispatching' | 'unknown' | 'confirmed' | 'refused' | 'cancelled';
const stateSchema = z.object({ state: z.enum(['prepared', 'dispatching', 'unknown', 'confirmed', 'refused', 'cancelled']), receipt: releaseProviderMergeReceiptSchema.optional() }).strict();
/** Provider-specific verifier ports, composed with separately enabled server authority.
 * assertCurrent must freshly verify paired session, commercial access, executor and
 * independent approver capabilities for this provider purpose (executor deploy:execute, approver agent:approve, both github:read), never merely accepted membership. readProviderApproval must read a genuine provider-purpose
 * separately authorized exact approval; advisory release-plan reviews and simulation approvals are insufficient. Source policy must explicitly accept observed-only base SHA.
 */
export interface ProviderMergeDependencies {
    assertCurrent?: (tx: ReleaseOperationPlanTransaction, scope: ProviderMergeScope, binding?: Readonly<Binding>) => Promise<void>;
    readProviderApproval?: (tx: ReleaseOperationPlanTransaction, scope: ProviderMergeScope, planId: string, executionId?: string) => Promise<unknown>;
    consumeProviderApproval?: (tx: ReleaseOperationPlanTransaction, scope: ProviderMergeScope, approvalId: string, executionId: string) => Promise<void>;
    now?: () => Date;
}
export class ProviderMergeUnavailable extends Error {
    constructor(readonly code = 'merge_execution_unavailable') { super(code); this.name = 'ProviderMergeUnavailable'; }
}
const refuse = (code?: string): never => { throw new ProviderMergeUnavailable(code); };
function planInput(binding: Binding) { return parseReleaseOperationPlanInput(binding.planInput); }
function snapshot(row: ReleaseOperationPlanRow) {
    const binding = bindingSchema.parse(row.inputJson), p = planInput(binding), state = stateSchema.parse(row.stateJson);
    if (row.organizationId !== binding.scope.organizationId || row.workflowKind !== RELEASE_PROVIDER_MERGE_KIND || row.id !== executionId(binding) || row.requestedByUserId !== binding.scope.actorUserId || row.maxAttempts !== 1 || row.approvalProposalId !== null || sha256ContentHash(p.plan) !== p.planDigest || p.plan.organizationId !== binding.scope.organizationId || p.releaseRequesterUserId !== binding.requesterUserId || p.planDigest !== binding.approval.planDigest)
        refuse();
    const expected = state.state === 'prepared' ? { attempt: 0, status: 'paused_for_input', version: 0 } : state.state === 'cancelled' ? { attempt: 0, status: 'cancelled', version: 1 } : state.state === 'dispatching' ? { attempt: 1, status: 'running', version: 1 } : { attempt: 1, status: state.state === 'unknown' ? 'paused_for_input' : 'completed', version: 2 };
    if (row.attemptCount !== expected.attempt || row.version !== expected.version || row.status !== expected.status || row.currentStep !== state.state || Boolean(row.leaseOwner) !== (state.state === 'dispatching') || Boolean(row.leaseExpiresAt) !== (state.state === 'dispatching'))
        refuse();
    if((state.state==='confirmed')!==(state.receipt!==undefined)||state.receipt&&(state.receipt.repositoryFullName!==p.plan.pullRequest.repositoryFullName||state.receipt.pullRequestNumber!==p.plan.pullRequest.number||state.receipt.headSha!==p.plan.pullRequest.headSha))refuse('provider_receipt_mismatch');return { binding, state: state.state, receipt: state.receipt };
}
function executionId(binding: Binding) { return 'release_merge_provider_' + sha256ContentHash({ organizationId: binding.scope.organizationId, planId: binding.planId }); }
function dto(row:ReleaseOperationPlanRow){const s=snapshot(row);return parseReleaseProviderMergeDto({id:row.id,state:s.state,attemptCount:row.attemptCount,version:row.version,mode:'provider',providerWritePerformed:s.state==='confirmed'?true:['dispatching','unknown'].includes(s.state)?null:false,...(s.receipt?{receipt:s.receipt}:{})})}
export type ProviderMergeDto = ReturnType<typeof dto>;
export function createReleaseProviderMergeStore(repo: ReleaseOperationPlanRepo, deps: ProviderMergeDependencies) {
    const now = () => { const d = new Date((deps.now?.() ?? new Date()).getTime()); if (!Number.isFinite(d.getTime()))
        refuse(); return d; };
    async function authority(tx: ReleaseOperationPlanTransaction, scope: ProviderMergeScope, binding?: Binding) { const verify = deps.assertCurrent; if (typeof verify !== 'function')
        return refuse('authority_unavailable'); await verify(tx, scope, binding ? structuredClone(binding) : undefined); }
    async function approval(tx: ReleaseOperationPlanTransaction, scope: ProviderMergeScope, planId: string, executionId?: string) { const read = deps.readProviderApproval; if (typeof read !== 'function')
        return refuse('approval_unavailable'); return approvalSchema.parse(await read(tx, scope, planId, executionId)); }
    async function load(tx: ReleaseOperationPlanTransaction, scope: ProviderMergeScope, execution: string) {
        if (!/^release_merge_provider_[a-f0-9]{64}$/.test(execution))
            refuse();
        const rows = await tx.$queryRaw<ReleaseOperationPlanRow[]> `SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${execution} AND "organizationId"=${scope.organizationId} AND "workflowKind"=${RELEASE_PROVIDER_MERGE_KIND} FOR UPDATE`;
        if (rows.length !== 1)
            refuse();
        const row = rows[0], s = snapshot(row);
        if (sha256ContentHash(s.binding.scope) !== sha256ContentHash(scope))
            refuse();
        const events = await tx.durableAgentWorkflowEvent.findMany({ where: { workflowRunId: row.id, organizationId: scope.organizationId }, orderBy: { sequence: 'asc' }, take: 4 });
        if (events.length !== row.version + 1 || events.some((e, i) => e.workflowRunId !== row.id || e.organizationId !== scope.organizationId || e.sequence !== i || e.eventType !== 'release_merge_provider.' + (i === 0 ? 'prepared' : i === 1 && s.state !== 'cancelled' ? 'dispatching' : s.state) || e.actorId !== scope.actorUserId || !Number.isFinite(e.occurredAt.getTime())))
            refuse();
        return row;
    }
    async function event(tx: ReleaseOperationPlanTransaction, row: ReleaseOperationPlanRow, state: ProviderMergeState) { await tx.durableAgentWorkflowEvent.create({ data: { workflowRunId: row.id, organizationId: row.organizationId, sequence: row.version, eventType: 'release_merge_provider.' + state, actorKind: 'user', actorId: row.requestedByUserId, detailJson: { mode:'provider' }, occurredAt: now() } }); }
    async function live(tx: ReleaseOperationPlanTransaction, binding: Binding, lease?: Date) { const p = planInput(binding), deadline = new Date(Math.min(Date.parse(p.deadlineAt), Date.parse(binding.approval.expiresAt), lease?.getTime() ?? Infinity)); const start = new Date(p.plan.window.startUtc); if (now() < start || now() >= deadline)
        refuse(); const rows = await tx.$queryRaw<Array<{
        live: boolean;
    }>> `SELECT clock_timestamp() < ${deadline} AND clock_timestamp() >= ${start} AS "live"`; if (rows.length !== 1 || rows[0].live !== true)
        refuse(); }
    async function current(tx: ReleaseOperationPlanTransaction, scope: ProviderMergeScope, binding: Binding) {
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
    async function change(tx: ReleaseOperationPlanTransaction, row: ReleaseOperationPlanRow, state: ProviderMergeState, extra: Record<string, unknown> = {}) { const data = { status: state === 'dispatching' ? 'running' : state === 'cancelled' ? 'cancelled' : ['unknown', 'prepared'].includes(state) ? 'paused_for_input' : 'completed', currentStep: state, stateJson: { state, ...('receipt' in extra ? { receipt: extra.receipt } : {}) }, version: { increment: 1 }, updatedAt: now(), ...extra }; delete (data as Record<string, unknown>).receipt; const result = await tx.durableAgentWorkflow.updateMany({ where: { id: row.id, organizationId: row.organizationId, workflowKind: RELEASE_PROVIDER_MERGE_KIND, version: row.version, status: row.status, currentStep: row.currentStep, attemptCount: row.attemptCount, inputJson: { equals: row.inputJson } }, data }); if (result.count !== 1)
        refuse(); const updated = { ...row, ...data, version: row.version + 1 } as ReleaseOperationPlanRow; await event(tx, updated, state); return updated; }
    return {
        async prepare(rawScope: ProviderMergeScope, planId: string) { const scope = scopeSchema.parse(rawScope); if (!deps.readProviderApproval)
            refuse('approval_unavailable'); return repo.$transaction(async (tx) => { await authority(tx, scope); const plans = await tx.$queryRaw<ReleaseOperationPlanRow[]> `SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${planId} AND "organizationId"=${scope.organizationId} FOR SHARE`; if (plans.length !== 1)
            refuse(); const row = plans[0], p = parseReleaseOperationPlanInput(row.inputJson); if (row.id !== releaseOperationPlanId(scope.organizationId, p.plan.requestId, p.plan.requestVersion, p.planDigest))
            refuse(); const a = await approval(tx, scope, planId, 'release_merge_provider_' + sha256ContentHash({ organizationId: scope.organizationId, planId })); const binding = bindingSchema.parse({ format: 1, mode:'provider', scope, planId, planVersion: 1, planInput: p, creatorUserId: row.requestedByUserId, requesterUserId: p.releaseRequesterUserId, approval: a }); await current(tx, scope, binding); const execution = executionId(binding), existing = await tx.durableAgentWorkflow.findFirst({ where: { id: execution, organizationId: scope.organizationId, workflowKind: RELEASE_PROVIDER_MERGE_KIND } }); if (existing) {
            const previous = await load(tx, scope, execution);
            if (sha256ContentHash(previous.inputJson) !== sha256ContentHash(binding))
                refuse();
            await authority(tx, scope, binding);
            await live(tx, binding);
            return dto(previous);
        } const at = now(); const saved = await tx.durableAgentWorkflow.create({ data: { id: execution, organizationId: scope.organizationId, workflowKind: RELEASE_PROVIDER_MERGE_KIND, objective:'Execute one exact independently approved provider merge', status: 'paused_for_input', autonomyLevel: 'observe', currentStep: 'prepared', inputJson: binding, stateJson: { state: 'prepared' }, requestedByUserId: scope.actorUserId, attemptCount: 0, maxAttempts: 1, version: 0, leaseOwner: null, leaseExpiresAt: null, approvalProposalId: null, nextAttemptAt: null, createdAt: at, updatedAt: at } }); await event(tx, saved, 'prepared'); await current(tx,scope,binding); await live(tx,binding); return dto(saved); }); },
        async claim(rawScope: ProviderMergeScope, execution: string) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); await authority(tx, scope, s.binding); if (s.state !== 'prepared')
            return { claimed: false as const, record: dto(row) }; await current(tx, scope, s.binding); if (typeof deps.consumeProviderApproval !== 'function') refuse('approval_consumption_unavailable'); await deps.consumeProviderApproval!(tx, scope, s.binding.approval.id, row.id); const lease = new Date(Math.min(now().getTime() + 30000, Date.parse(planInput(s.binding).deadlineAt), Date.parse(s.binding.approval.expiresAt))); const updated = await change(tx, row, 'dispatching', { attemptCount: 1, leaseOwner: row.id, leaseExpiresAt: lease }); await current(tx,scope,s.binding); await live(tx,s.binding,lease); return { claimed: true as const, record: dto(updated), plan:structuredClone(planInput(s.binding).plan),leaseExpiresAt: lease }; }); },
        async beforeDispatch(rawScope: ProviderMergeScope, execution: string) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); if (s.state !== 'dispatching')
            refuse(); await current(tx, scope, s.binding); await live(tx, s.binding, row.leaseExpiresAt!); return structuredClone(planInput(s.binding).plan); }); },
        async finish(rawScope: ProviderMergeScope, execution: string, result: {
            state: 'unknown' | 'confirmed' | 'refused';
            receipt?:ProviderMergeReceipt;
        }) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); if (s.state !== 'dispatching')
            return dto(row); const final = z.object({ state: z.enum(['unknown', 'confirmed', 'refused']), receipt: releaseProviderMergeReceiptSchema.optional() }).strict().refine(v => (v.state === 'confirmed') === (v.receipt !== undefined)).parse(result); if(final.receipt){const plan=planInput(s.binding).plan;if(final.receipt.repositoryFullName!==plan.pullRequest.repositoryFullName||final.receipt.pullRequestNumber!==plan.pullRequest.number||final.receipt.headSha!==plan.pullRequest.headSha)refuse('provider_receipt_mismatch')}if (final.state !== 'unknown') {
            await current(tx, scope, s.binding);
            await live(tx, s.binding, row.leaseExpiresAt!);
        } const updated = await change(tx, row, final.state, { leaseOwner: null, leaseExpiresAt: null, ...(final.receipt ? { receipt: final.receipt } : {}) }); if (final.state !== 'unknown') {
            await current(tx,scope,s.binding);
            await live(tx, s.binding, row.leaseExpiresAt!);
        } return dto(updated); }); },
        async get(rawScope: ProviderMergeScope, execution: string) { const scope=scopeSchema.parse(rawScope);return repo.$transaction(async tx=>{const row=await load(tx,scope,execution),s=snapshot(row);await authority(tx,scope,s.binding);const result=dto(row);await authority(tx,scope,s.binding);return result}); },
        async recover(rawScope: ProviderMergeScope, execution: string, expectedVersion?:number) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); if(expectedVersion!==undefined&&(!Number.isSafeInteger(expectedVersion)||expectedVersion!==row.version))refuse('provider_merge_refresh_required');await authority(tx, scope, s.binding); if (s.state === 'dispatching' && row.leaseExpiresAt!.getTime() <= now().getTime())
            {const updated=await change(tx,row,'unknown',{leaseOwner:null,leaseExpiresAt:null});await authority(tx,scope,s.binding);return dto(updated)}await authority(tx,scope,s.binding);return dto(row); }); },
        async cancel(rawScope: ProviderMergeScope, execution: string) { const scope = scopeSchema.parse(rawScope); return repo.$transaction(async (tx) => { const row = await load(tx, scope, execution), s = snapshot(row); await authority(tx, scope, s.binding); if (s.state !== 'prepared')
            return dto(row); const updated = await change(tx, row, 'cancelled'); await authority(tx, scope, s.binding); return dto(updated); }); },
    };
}
export type ReleaseProviderMergeStore = ReturnType<typeof createReleaseProviderMergeStore>;
