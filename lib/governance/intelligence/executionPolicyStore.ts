import 'server-only';
import { z } from 'zod';
import { sha256ContentHash } from '@/lib/tauri/contentHash';
import type { ReleaseOperationPlanRepo, ReleaseOperationPlanTransaction as Tx, ReleaseOperationPlanRow as Row } from '@/lib/agent/workflows/releaseOperationPlanStore';
import { GOVERNED_ACTIONS, identifier, digestSchema, scopeSchema, type GovernanceScope } from './contracts';
import type { RevisionScope } from './revisionStore';
const REVISION = 'governance_execution_policy_revision_v1';
const POINTER = 'governance_execution_policy_active_v1';
const REQUEST = 'governance_execution_policy_request_v1';
const nonce = z.string().uuid();
const version = z.number().int().min(0).max(999);
const callerSchema = z.object({
    organizationId: identifier,
    actorUserId: identifier,
    sessionId: identifier
}).strict();
const policySchema = z.object({
    organizationId: identifier,
    scope: scopeSchema,
    parentDigest: digestSchema.nullable(),
    autonomyLevel: z.number().int().min(0).max(5),
    actions: z.array(z.enum(GOVERNED_ACTIONS)).min(1).max(GOVERNED_ACTIONS.length).refine(a => new Set(a).size === a.length),
    executorUserIds: z.array(identifier).min(1).max(100).refine(a => new Set(a).size === a.length),
    expiresAt: z.string().datetime(),
}).strict();
export function compileExecutionPolicy(raw: unknown) {
    const input = policySchema.parse(raw);
    return { ...input, digest: sha256ContentHash({ kind: REVISION, ...input }) };
}
export type ExecutionPolicy = ReturnType<typeof compileExecutionPolicy>;
export type ExecutionPolicyRole = 'reader' | 'policy_admin' | 'approver';
export interface ExecutionPolicyPorts {
    /** Must recheck current paired caller and each recorded principal's current
     * membership, capability and exact session. This is never a client port. */
    assertCurrent(tx: Tx, scope: RevisionScope, actor: {
        userId: string;
        sessionId: string;
    }, role: ExecutionPolicyRole): Promise<void>;
    now?: () => Date;
}
const approvalSchema = z.object({
    userId: identifier,
    sessionId: identifier,
    digest: digestSchema,
    clientRequestId: nonce,
    at: z.string().datetime()
}).strict();
const revisionInput = z.object({
    format: z.literal(1),
    policy: z.unknown(),
    requesterUserId: identifier,
    sessionId: identifier,
    clientRequestId: nonce,
    createdAt: z.string().datetime()
}).strict();
const revisionState = z.object({ status: z.enum(['proposed', 'approved', 'revoked']), approval: approvalSchema.nullable() }).strict();
const pointerInput = z.object({
    format: z.literal(1),
    organizationId: identifier,
    scope: scopeSchema
}).strict();
const pointerState = z.object({
    revisionId: identifier,
    digest: digestSchema,
    parentDigest: digestSchema.nullable(),
    actorUserId: identifier,
    sessionId: identifier,
    clientRequestId: nonce
}).strict();
const eventDetail = z.object({
    actorSessionId: identifier,
    inputDigest: digestSchema,
    state: z.unknown(),
    stateDigest: digestSchema,
    previousStateDigest: digestSchema.nullable(),
    clientRequestId: nonce,
    expectedVersion: version.nullable()
}).strict();
const requestInput = z.object({
    format: z.literal(1), organizationId: identifier, actorUserId: identifier,
    sessionId: identifier, operation: z.enum(['propose', 'approve', 'activate', 'revoke']),
    inputDigest: digestSchema, clientRequestId: nonce, createdAt: z.string().datetime(),
}).strict();
const requestState = z.object({result: z.unknown(), resultDigest: digestSchema}).strict();
const revisionId = (org: string, digest: string) => 'governance_execution_policy_' + sha256ContentHash({ organizationId: org, digest });
const pointerId = (org: string, scope: GovernanceScope) => 'governance_execution_policy_active_' + sha256ContentHash({ organizationId: org, scope });
const deny = (): never => { throw Error('governance_execution_policy_unavailable'); };
function unpackPolicy(raw: unknown) {
    if (!raw || typeof raw !== 'object')
        return deny();
    const { digest, ...input } = raw as ExecutionPolicy, policy = compileExecutionPolicy(input);
    if (digest !== policy.digest || sha256ContentHash(raw) !== sha256ContentHash(policy))
        deny();
    return policy;
}
/** Local persistent limits only. An active policy never establishes executor
 * coverage, baseline enrollment, provider access or permission to dispatch. */
export function createGovernanceExecutionPolicyStore(repo: ReleaseOperationPlanRepo, ports: ExecutionPolicyPorts) {
    function now() {
        const at = ports.now?.() ?? new Date();
        if (!Number.isFinite(at.getTime()))
            deny();
        return at;
    }
    async function transaction<T>(scope: RevisionScope, run: (tx: Tx) => Promise<T>, existing?: Tx) {
        const checked = async (tx: Tx) => {
            await tx.$queryRaw `SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_execution_policy_org_' + sha256ContentHash(scope.organizationId)}))`;
            return run(tx);
        };
        return existing ? checked(existing) : repo.$transaction(checked);
    }
    async function authority(tx: Tx, s: RevisionScope, userId: string, sessionId: string, role: ExecutionPolicyRole) {
        if (typeof ports.assertCurrent !== 'function')
            deny();
        await ports.assertCurrent(tx, s, { userId, sessionId }, role);
    }
    async function live(tx: Tx, p: ExecutionPolicy) {
        const rows = await tx.$queryRaw<Array<{
            live: boolean;
        }>> `SELECT clock_timestamp() < ${new Date(p.expiresAt)} AS live`;
        if (rows.length !== 1 || rows[0].live !== true || Date.parse(p.expiresAt) <= now().getTime())
            deny();
    }
    function sane(row: Row, s: RevisionScope, kind: string) {
        if (row.organizationId !== s.organizationId ||
            row.workflowKind !== kind ||
            row.status !== 'paused_for_input' ||
            row.attemptCount !== 0 ||
            row.maxAttempts !== 1 ||
            row.leaseOwner ||
            row.leaseExpiresAt ||
            row.approvalProposalId ||
            !version.safeParse(row.version).success)
            deny();
    }
    function unpack(row: Row, s: RevisionScope) {
        sane(row, s, REVISION);
        const input = revisionInput.parse(row.inputJson), policy = unpackPolicy(input.policy), state = revisionState.parse(row.stateJson);
        if (policy.organizationId !== s.organizationId ||
            row.id !== revisionId(s.organizationId, policy.digest) ||
            row.requestedByUserId !== input.requesterUserId ||
            row.currentStep !== state.status ||
            row.createdAt.toISOString() !== input.createdAt ||
            row.version !== (state.status === 'proposed' ? 0 : state.status === 'approved' ? 1 : state.approval ? 2 : 1) ||
            Boolean(state.approval) !== (state.status === 'approved' ||
            state.status === 'revoked' && row.version === 2))
            deny();
        if (state.approval && (state.approval.digest !== policy.digest ||
            state.approval.userId === input.requesterUserId ||
            policy.executorUserIds.includes(state.approval.userId)))
            deny();
        return {
            row,
            input,
            policy,
            state
        };
    }
    async function history(tx: Tx, row: Row, s: RevisionScope, kind: string) {
        const events = await tx.durableAgentWorkflowEvent.findMany({
            where: { organizationId: s.organizationId, workflowRunId: row.id },
            orderBy: { sequence: 'asc' },
            take: 1001
        });
        if (events.length !== row.version + 1)
            deny();
        let previous: string | null = null;
        for (let i = 0; i < events.length; i++) {
            const e = events[i], d = eventDetail.parse(e.detailJson);
            if (e.organizationId !== s.organizationId ||
                e.workflowRunId !== row.id ||
                e.sequence !== i ||
                e.actorKind !== 'user' ||
                !e.actorId ||
                d.inputDigest !== sha256ContentHash(row.inputJson) ||
                d.stateDigest !== sha256ContentHash(d.state) ||
                d.previousStateDigest !== previous ||
                d.expectedVersion !== (i ? i - 1 : null) ||
                !Number.isFinite(e.occurredAt.getTime()) ||
                e.occurredAt < row.createdAt ||
                i === 0 && (e.occurredAt.getTime() !== row.createdAt.getTime() ||
                e.actorId !== row.requestedByUserId) ||
                i && e.occurredAt < events[i - 1].occurredAt)
                deny();
            if (kind === REVISION) {
                const x = unpack(row, s), st = revisionState.parse(d.state), prior = i ? revisionState.parse(eventDetail.parse(events[i - 1].detailJson).state) : null;
                if (e.eventType !== REVISION + '.' + st.status ||
                    i === 0 && (st.status !== 'proposed' ||
                    st.approval !== null ||
                    e.actorId !== x.input.requesterUserId ||
                    d.clientRequestId !== x.input.clientRequestId ||
                    d.actorSessionId !== x.input.sessionId) ||
                    i > 0 && (st.status === 'proposed' ||
                    prior?.status === 'revoked') ||
                    st.status === 'approved' && (prior?.status !== 'proposed' ||
                    !st.approval ||
                    e.actorId !== st.approval.userId ||
                    st.approval.digest !== x.policy.digest ||
                    st.approval.userId === x.input.requesterUserId ||
                    x.policy.executorUserIds.includes(st.approval.userId) ||
                    st.approval.sessionId !== d.actorSessionId ||
                    st.approval.clientRequestId !== d.clientRequestId ||
                    st.approval.at !== e.occurredAt.toISOString()) ||
                    st.status === 'revoked' && sha256ContentHash(st.approval) !== sha256ContentHash(prior?.approval))
                    deny();
            }
            else {
                const st = pointerState.parse(d.state);
                if (e.eventType !== POINTER + '.activated' ||
                    st.actorUserId !== e.actorId ||
                    st.sessionId !== d.actorSessionId ||
                    st.clientRequestId !== d.clientRequestId ||
                    st.revisionId !== revisionId(s.organizationId, st.digest) ||
                    i && st.parentDigest !== pointerState.parse(eventDetail.parse(events[i - 1].detailJson).state).digest ||
                    i === 0 && st.parentDigest !== null)
                    deny();
            }
            previous = d.stateDigest;
        }
        if (previous !== sha256ContentHash(row.stateJson) || events.at(-1)!.occurredAt.getTime() !== row.updatedAt.getTime())
            deny();
        return events;
    }
    async function load(tx: Tx, s: RevisionScope, id: string) {
        if (!/^governance_execution_policy_[a-f0-9]{64}$/.test(id))
            deny();
        const rows = await tx.$queryRaw<Row[]> `SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} AND "organizationId"=${s.organizationId} FOR UPDATE`;
        if (rows.length !== 1)
            deny();
        const result = unpack(rows[0], s);
        await history(tx, result.row, s, REVISION);
        return result;
    }
    async function pointer(tx: Tx, s: RevisionScope, selection: GovernanceScope) {
        const id = pointerId(s.organizationId, selection);
        const rows = await tx.$queryRaw<Row[]> `SELECT * FROM "DurableAgentWorkflow" WHERE "id"=${id} FOR UPDATE`;
        if (!rows.length)
            return null;
        if (rows.length !== 1)
            deny();
        const row = rows[0];
        sane(row, s, POINTER);
        const input = pointerInput.parse(row.inputJson), state = pointerState.parse(row.stateJson);
        if (row.id !== id || input.organizationId !== s.organizationId || sha256ContentHash(input.scope) !== sha256ContentHash(selection) || row.currentStep !== 'active')
            deny();
        await history(tx, row, s, POINTER);
        return { row, state };
    }
    async function principals(tx: Tx, s: RevisionScope, x: Awaited<ReturnType<typeof load>>) {
        await authority(tx, s, s.actorUserId, s.sessionId, 'reader');
        await authority(tx, s, x.input.requesterUserId, x.input.sessionId, 'policy_admin');
        if (x.state.approval)
            await authority(tx, s, x.state.approval.userId, x.state.approval.sessionId, 'approver');
    }
    async function event(tx: Tx, row: Row, actor: string, actorSessionId: string, requestId: string, previousStateDigest: string | null) {
        await tx.durableAgentWorkflowEvent.create({ data: {
                workflowRunId: row.id,
                organizationId: row.organizationId,
                sequence: row.version,
                eventType: row.workflowKind + '.' + (row.workflowKind === POINTER ? 'activated' : row.currentStep),
                actorKind: 'user',
                actorId: actor,
                detailJson: {
                    actorSessionId,
                    inputDigest: sha256ContentHash(row.inputJson),
                    state: row.stateJson,
                    stateDigest: sha256ContentHash(row.stateJson),
                    previousStateDigest,
                    clientRequestId: requestId,
                    expectedVersion: row.version ? row.version - 1 : null
                },
                occurredAt: row.updatedAt
            } });
    }
    async function create(tx: Tx, s: RevisionScope, id: string, kind: string, input: unknown, state: unknown, step: string, requestId: string) {
        const at = kind === REVISION ? new Date(revisionInput.parse(input).createdAt) : kind === REQUEST ? new Date(requestInput.parse(input).createdAt) : now(), row = await tx.durableAgentWorkflow.create({ data: {
                id,
                organizationId: s.organizationId,
                workflowKind: kind,
                objective: 'Reviewed exact-scope execution limits; no provider execution or enrollment',
                status: 'paused_for_input',
                autonomyLevel: 'observe',
                currentStep: step,
                inputJson: input,
                stateJson: state,
                requestedByUserId: s.actorUserId,
                attemptCount: 0,
                maxAttempts: 1,
                version: 0,
                leaseOwner: null,
                leaseExpiresAt: null,
                approvalProposalId: null,
                nextAttemptAt: null,
                createdAt: at,
                updatedAt: at
            } });
        await event(tx, row, s.actorUserId, s.sessionId, requestId, null);
        return row;
    }
    async function update(tx: Tx, row: Row, state: unknown, step: string, s: RevisionScope, requestId: string) {
        const at = step === 'approved' ? new Date(revisionState.parse(state).approval!.at) : now();
        if (at < row.updatedAt || row.version >= 999)
            deny();
        const change = await tx.durableAgentWorkflow.updateMany({ where: {
                id: row.id,
                organizationId: row.organizationId,
                workflowKind: row.workflowKind,
                version: row.version,
                inputJson: { equals: row.inputJson },
                stateJson: { equals: row.stateJson },
                attemptCount: 0,
                maxAttempts: 1,
                leaseOwner: null,
                leaseExpiresAt: null
            }, data: {
                stateJson: state,
                currentStep: step,
                version: { increment: 1 },
                updatedAt: at
            } });
        if (change.count !== 1)
            deny();
        const next = {
            ...row,
            stateJson: state,
            currentStep: step,
            version: row.version + 1,
            updatedAt: at
        };
        await event(tx, next, s.actorUserId, s.sessionId, requestId, sha256ContentHash(row.stateJson));
        return next;
    }
    async function recordedResult(tx: Tx, s: RevisionScope, row: Row, id: string, requestId: string, expected: {operation: z.infer<typeof requestInput>['operation']; inputDigest?: string}) {
                sane(row, s, REQUEST);
                const saved = requestInput.parse(row.inputJson), state = requestState.parse(row.stateJson);
                if (row.id !== id || row.version !== 0 || row.currentStep !== 'recorded' || row.requestedByUserId !== s.actorUserId || saved.organizationId !== s.organizationId || saved.actorUserId !== s.actorUserId || saved.sessionId !== s.sessionId || saved.operation !== expected.operation || (expected.inputDigest !== undefined && saved.inputDigest !== expected.inputDigest) || saved.clientRequestId !== requestId || saved.createdAt !== row.createdAt.toISOString() || state.resultDigest !== sha256ContentHash(state.result)) deny();
                const events = await tx.durableAgentWorkflowEvent.findMany({where: {organizationId: s.organizationId, workflowRunId: id}, orderBy: {sequence: 'asc'}, take: 2});
                if (events.length !== 1) deny();
                const e = events[0], detail = eventDetail.parse(e.detailJson);
                if (e.organizationId !== s.organizationId || e.workflowRunId !== id || e.sequence !== 0 || e.eventType !== REQUEST + '.recorded' || e.actorKind !== 'user' || e.actorId !== s.actorUserId || detail.actorSessionId !== s.sessionId || detail.inputDigest !== sha256ContentHash(row.inputJson) || detail.stateDigest !== sha256ContentHash(row.stateJson) || sha256ContentHash(detail.state) !== detail.stateDigest || detail.previousStateDigest !== null || detail.expectedVersion !== null || detail.clientRequestId !== requestId || e.occurredAt.getTime() !== row.createdAt.getTime() || row.updatedAt.getTime() !== row.createdAt.getTime()) deny();
                return structuredClone(state.result);
    }
    /** A nonce is organization-wide and single purpose. The marker and result
     * commit atomically with the mutation under the existing organization lock.
     * Recovery returns the original inert result, never a new current grant. */
    async function mutate<T>(s: RevisionScope, operation: z.infer<typeof requestInput>['operation'], input: unknown, requestId: string, run: (tx: Tx) => Promise<T>): Promise<T> {
        return transaction(s, async tx => {
            await authority(tx, s, s.actorUserId, s.sessionId, operation === 'approve' ? 'approver' : 'policy_admin');
            const id = 'governance_execution_policy_request_' + sha256ContentHash({organizationId: s.organizationId, requestId});
            const inputDigest = sha256ContentHash(input);
            const row = await tx.durableAgentWorkflow.findFirst({where: {id}});
            if (row) {
                return await recordedResult(tx, s, row, id, requestId, {operation, inputDigest}) as T;
            }
            const result = await run(tx);
            await create(tx, s, id, REQUEST, {format: 1, organizationId: s.organizationId, actorUserId: s.actorUserId, sessionId: s.sessionId, operation, inputDigest, clientRequestId: requestId, createdAt: now().toISOString()}, {result, resultDigest: sha256ContentHash(result)}, 'recorded', requestId);
            await authority(tx, s, s.actorUserId, s.sessionId, operation === 'approve' ? 'approver' : 'policy_admin');
            return result;
        });
    }
    const view = (x: Awaited<ReturnType<typeof load>>) => ({
        id: x.row.id,
        version: x.row.version,
        status: x.state.status,
        policy: x.policy,
        requesterUserId: x.input.requesterUserId,
        approval: x.state.approval,
        executionAuthorized: false as const
    });
    return {
        /** Historical receipt lookup never invokes the original mutation and
         * cannot re-establish current policy authority. */
        async lookupRequest(rawScope: RevisionScope, operation: z.infer<typeof requestInput>['operation'], requestId: string) {
            const s=callerSchema.parse(rawScope);nonce.parse(requestId);requestInput.shape.operation.parse(operation);
            return transaction(s,async tx=>{
                await authority(tx,s,s.actorUserId,s.sessionId,'reader');
                const id='governance_execution_policy_request_'+sha256ContentHash({organizationId:s.organizationId,requestId});
                const row=await tx.durableAgentWorkflow.findFirst({where:{id}});
                if(!row){await authority(tx,s,s.actorUserId,s.sessionId,'reader');return{found:false as const,historical:true as const,executionAuthorized:false as const}}
                const result=await recordedResult(tx,s,row,id,requestId,{operation});
                await authority(tx,s,s.actorUserId,s.sessionId,'reader');
                return{found:true as const,result,historical:true as const,executionAuthorized:false as const};
            });
        },
        /** Reads the pointer for exact parent/CAS selection, including historical
         * revoked/expired limits. It is deliberately not readAuthority. */
        async readActivePointer(rawScope: RevisionScope, rawSelection: GovernanceScope) {
            const s=callerSchema.parse(rawScope),selection=scopeSchema.parse(rawSelection);
            return transaction(s,async tx=>{
                await authority(tx,s,s.actorUserId,s.sessionId,'reader');
                const p=await pointer(tx,s,selection);
                if(!p){await authority(tx,s,s.actorUserId,s.sessionId,'reader');return{found:false as const,scope:selection,executionAuthorized:false as const}}
                const x=await load(tx,s,p.state.revisionId);
                if(x.policy.digest!==p.state.digest||sha256ContentHash(x.policy.scope)!==sha256ContentHash(selection)||x.policy.parentDigest!==p.state.parentDigest)deny();
                await authority(tx,s,s.actorUserId,s.sessionId,'reader');
                return{found:true as const,scope:selection,revisionId:x.row.id,digest:x.policy.digest,pointerVersion:p.row.version,parentDigest:x.policy.parentDigest,policyStatus:x.state.status,expiresAt:x.policy.expiresAt,executionAuthorized:false as const};
            });
        },
        async propose(rawScope: RevisionScope, raw: unknown, requestId: string) {
            const s = callerSchema.parse(rawScope), policy = compileExecutionPolicy(raw);
            nonce.parse(requestId);
            if (policy.organizationId !== s.organizationId)
                deny();
            return mutate(s, 'propose', policy, requestId, async (tx) => {
                await authority(tx, s, s.actorUserId, s.sessionId, 'policy_admin');
                await live(tx, policy);
                const id = revisionId(s.organizationId, policy.digest), existing = await tx.durableAgentWorkflow.findFirst({ where: { id } });
                if (existing) {
                    const x = await load(tx, s, id);
                    await principals(tx, s, x);
                    if (x.input.requesterUserId !== s.actorUserId || x.input.sessionId !== s.sessionId || x.input.clientRequestId !== requestId)
                        deny();
                    return view(x);
                }
                await create(tx, s, id, REVISION, {
                    format: 1,
                    policy,
                    requesterUserId: s.actorUserId,
                    sessionId: s.sessionId,
                    clientRequestId: requestId,
                    createdAt: now().toISOString()
                }, { status: 'proposed', approval: null }, 'proposed', requestId);
                await authority(tx, s, s.actorUserId, s.sessionId, 'policy_admin');
                return view(await load(tx, s, id));
            });
        },
        async readRevision(rawScope: RevisionScope, id: string) {
            const s = callerSchema.parse(rawScope);
            return transaction(s, async (tx) => { await authority(tx, s, s.actorUserId, s.sessionId, 'reader'); return view(await load(tx, s, id)); });
        },
        async approve(rawScope: RevisionScope, id: string, expectedVersion: number, digest: string, requestId: string) {
            const s = callerSchema.parse(rawScope);
            nonce.parse(requestId);
            digestSchema.parse(digest);
            version.parse(expectedVersion);
            return mutate(s, 'approve', {id, expectedVersion, digest}, requestId, async (tx) => {
                const x = await load(tx, s, id);
                await principals(tx, s, x);
                await authority(tx, s, s.actorUserId, s.sessionId, 'approver');
                await live(tx, x.policy);
                if (x.state.status === 'approved' && x.state.approval?.clientRequestId === requestId && x.state.approval.userId === s.actorUserId && x.state.approval.sessionId === s.sessionId && digest === x.policy.digest && expectedVersion === 0)
                    return view(x);
                if (x.state.status !== 'proposed' ||
                    x.row.version !== expectedVersion ||
                    digest !== x.policy.digest ||
                    s.actorUserId === x.input.requesterUserId ||
                    x.policy.executorUserIds.includes(s.actorUserId))
                    deny();
                const approval = {
                    userId: s.actorUserId,
                    sessionId: s.sessionId,
                    digest,
                    clientRequestId: requestId,
                    at: now().toISOString()
                };
                await update(tx, x.row, { status: 'approved', approval }, 'approved', s, requestId);
                await authority(tx, s, s.actorUserId, s.sessionId, 'approver');
                return view(await load(tx, s, id));
            });
        },
        async activate(rawScope: RevisionScope, id: string, expectedPointerVersion: number | null, expectedParent: string | null, requestId: string) {
            const s = callerSchema.parse(rawScope);
            nonce.parse(requestId);
            version.nullable().parse(expectedPointerVersion);
            digestSchema.nullable().parse(expectedParent);
            return mutate(s, 'activate', {id, expectedPointerVersion, expectedParent}, requestId, async (tx) => {
                const x = await load(tx, s, id);
                await principals(tx, s, x);
                await authority(tx, s, s.actorUserId, s.sessionId, 'policy_admin');
                await live(tx, x.policy);
                if (x.state.status !== 'approved' || !x.state.approval || x.policy.parentDigest !== expectedParent)
                    deny();
                const p = await pointer(tx, s, x.policy.scope);
                if (p?.state.clientRequestId === requestId) {
                    if (p.state.revisionId !== id ||
                        p.state.actorUserId !== s.actorUserId ||
                        p.state.sessionId !== s.sessionId ||
                        p.state.parentDigest !== expectedParent ||
                        p.row.version !== (expectedPointerVersion === null ? 0 : expectedPointerVersion + 1))
                        deny();
                    return {
                        digest: x.policy.digest,
                        pointerVersion: p.row.version,
                        executionAuthorized: false as const
                    };
                }
                if ((p?.row.version ?? null) !== expectedPointerVersion || (p?.state.digest ?? null) !== expectedParent)
                    deny();
                const state = {
                    revisionId: id,
                    digest: x.policy.digest,
                    parentDigest: expectedParent,
                    actorUserId: s.actorUserId,
                    sessionId: s.sessionId,
                    clientRequestId: requestId
                };
                const saved = p ? await update(tx, p.row, state, 'active', s, requestId) : await create(tx, s, pointerId(s.organizationId, x.policy.scope), POINTER, {
                    format: 1,
                    organizationId: s.organizationId,
                    scope: x.policy.scope
                }, state, 'active', requestId);
                await authority(tx, s, s.actorUserId, s.sessionId, 'policy_admin');
                return {
                    digest: x.policy.digest,
                    pointerVersion: saved.version,
                    executionAuthorized: false as const
                };
            });
        },
        async revoke(rawScope: RevisionScope, id: string, expectedVersion: number, requestId: string) {
            const s = callerSchema.parse(rawScope);
            nonce.parse(requestId);
            version.parse(expectedVersion);
            return mutate(s, 'revoke', {id, expectedVersion}, requestId, async (tx) => {
                const x = await load(tx, s, id);
                await authority(tx, s, s.actorUserId, s.sessionId, 'policy_admin');
                if (x.state.status === 'revoked') {
                    const events = await history(tx, x.row, s, REVISION), last = events.at(-1)!;
                    if (eventDetail.parse(last.detailJson).clientRequestId !== requestId ||
                        last.actorId !== s.actorUserId ||
                        eventDetail.parse(last.detailJson).actorSessionId !== s.sessionId ||
                        x.row.version !== expectedVersion + 1)
                        deny();
                    return view(x);
                }
                if (x.row.version !== expectedVersion)
                    deny();
                await update(tx, x.row, { ...x.state, status: 'revoked' }, 'revoked', s, requestId);
                await authority(tx, s, s.actorUserId, s.sessionId, 'policy_admin');
                return view(await load(tx, s, id));
            });
        },
        async readAuthority(rawScope: RevisionScope, rawSelection: GovernanceScope, action: typeof GOVERNED_ACTIONS[number], expectedDigest?: string, existingTx?: Tx) {
            const s = callerSchema.parse(rawScope), selection = scopeSchema.parse(rawSelection);
            z.enum(GOVERNED_ACTIONS).parse(action);
            if (expectedDigest !== undefined)
                digestSchema.parse(expectedDigest);
            return transaction(s, async (tx) => {
                await authority(tx, s, s.actorUserId, s.sessionId, 'reader');
                const p = await pointer(tx, s, selection);
                if (!p)
                    return deny();
                const x = await load(tx, s, p.state.revisionId);
                await principals(tx, s, x);
                await live(tx, x.policy);
                await authority(tx, s, p.state.actorUserId, p.state.sessionId, 'policy_admin');
                if (x.state.status !== 'approved' ||
                    !x.state.approval ||
                    x.policy.digest !== p.state.digest ||
                    x.policy.parentDigest !== p.state.parentDigest ||
                    sha256ContentHash(x.policy.scope) !== sha256ContentHash(selection) ||
                    expectedDigest !== undefined && expectedDigest !== x.policy.digest ||
                    !x.policy.actions.includes(action) ||
                    !x.policy.executorUserIds.includes(s.actorUserId))
                    deny();
                return {
                    policyDigest: x.policy.digest,
                    pointerVersion: p.row.version,
                    autonomyLevel: x.policy.autonomyLevel,
                    expiresAt: x.policy.expiresAt,
                    executionAuthorized: false as const
                };
            }, existingTx);
        },
    };
}
