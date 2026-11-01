import { expect, it, vi } from 'vitest';
import { buildReleaseMergePlan } from '../releaseMergePlan';
import { sha256ContentHash } from '../contentHash';
import { completeReleaseIntake } from './fixtures/completeReleaseIntake';
import { releaseOperationPlanId } from '@/lib/agent/workflows/releaseOperationPlanStore';
import { createReleaseProviderMergeStore, type ProviderMergeDependencies } from '../releaseProviderMergeStore';
function fixture() {
    const now = new Date('2030-01-02T01:30:00Z'), revision = new Date('2030-01-01T00:00:00Z');
    const intake = { ...completeReleaseIntake(), windowStartUtc: '2030-01-02T01:00:00Z', windowEndUtc: '2030-01-02T02:00:00Z', repositoryUrls: ['https://github.com/team/service'], productionPrUrls: ['https://github.com/team/service/pull/42'], sourceBranch: 'release/demo', targetBranch: 'main' };
    const release = { id: intake.id, organizationId: intake.tenantId, requesterUserId: 'requester', version: 3, status: 'submitted', intakeJson: intake };
    const connection = { id: 'github-1', organizationId: release.organizationId, status: 'active', updatedAt: revision, githubInstallationId: '123', revokedAt: null, suspendedAt: null };
    const built = buildReleaseMergePlan(release, { organizationId: release.organizationId, requestId: release.id, expectedVersion: 3, expectedDigest: sha256ContentHash({ requestVersion: 3, intake }), method: 'squash', observation: { connectionId: connection.id, connectionRevision: revision.toISOString(), repositoryFullName: 'team/service', number: 42, headRepositoryFullName: 'team/service', headRef: 'release/demo', headSha: 'a'.repeat(40), baseRef: 'main', baseSha: 'b'.repeat(40), state: 'open', draft: false, merged: false } });
    if (!built.ok)
        throw Error('bad fixture');
    const planId = releaseOperationPlanId(release.organizationId, release.id, 3, built.digest);
    const plan = { id: planId, organizationId: release.organizationId, workflowKind: 'release_operation_plan_v1', requestedByUserId: 'creator', status: 'completed', currentStep: 'reviewed', inputJson: { format: 1, plan: built.plan, planDigest: built.digest, releaseRequesterUserId: 'requester', createdAt: revision.toISOString(), deadlineAt: new Date(intake.windowEndUtc).toISOString() }, stateJson: { reviewStatus: 'reviewed' }, attemptCount: 0, maxAttempts: 1, version: 1, leaseOwner: null, leaseExpiresAt: null, approvalProposalId: null, createdAt: revision, updatedAt: now };
    const planEvents = [{ workflowRunId: planId, organizationId: release.organizationId, sequence: 0, eventType: 'release_plan.created', actorKind: 'user', actorId: 'creator', detailJson: { planDigest: built.digest }, occurredAt: revision }, { workflowRunId: planId, organizationId: release.organizationId, sequence: 1, eventType: 'release_plan.reviewed', actorKind: 'user', actorId: 'reviewer', detailJson: {}, occurredAt: now }];
    const rows: any[] = [], events: any[] = [];
    let serial = Promise.resolve();
    const repo: any = { durableAgentWorkflow: { findFirst: vi.fn(async ({ where }: any) => structuredClone(rows.find(r => r.id === where.id && r.organizationId === where.organizationId) ?? null)), create: vi.fn(async ({ data }: any) => { if (rows.some(r => r.id === data.id))
                throw Error('duplicate'); rows.push(structuredClone(data)); return structuredClone(data); }), updateMany: vi.fn(async ({ where, data }: any) => { const row = rows.find(r => Object.entries(where).every(([k, v]: any) => k === 'inputJson' ? sha256ContentHash(r[k]) === sha256ContentHash(v.equals) : v instanceof Date ? r[k]?.getTime() === v.getTime() : r[k] === v)); if (!row)
                return { count: 0 }; for (const [k, v] of Object.entries(data) as any)
                row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : structuredClone(v); return { count: 1 }; }) }, durableAgentWorkflowEvent: { findMany: vi.fn(async ({ where }: any) => structuredClone(where.workflowRunId === planId ? planEvents : events.filter(e => e.workflowRunId === where.workflowRunId))), create: vi.fn(async ({ data }: any) => { events.push(structuredClone(data)); return data; }) }, $queryRaw: vi.fn(async (sql: TemplateStringsArray, ...values: any[]) => { const q = sql.join(''); if (q.includes('clock_timestamp'))
            return [{ live: now.getTime() >= Date.parse(intake.windowStartUtc) && now.getTime() < new Date(values[0]).getTime() }]; if (q.includes('TauriDeploymentRequest'))
            return structuredClone([release]); if (q.includes('GitHubInstallation'))
            return structuredClone([connection]); if (q.includes('OrgMembership'))
            return [{ id: 'm', organizationId: values[0], userId: values[1], acceptedAt: revision }]; if (q.includes('DurableAgentWorkflow'))
            return structuredClone(values.includes(planId) ? [plan] : rows.filter(r => values.includes(r.id))); throw Error('unexpected SQL'); }) };
    repo.$transaction = (fn: any) => { const result = serial.then(async () => { const before = structuredClone({ rows, events }); try {
        return await fn(repo);
    }
    catch (e) {
        rows.splice(0, rows.length, ...before.rows);
        events.splice(0, events.length, ...before.events);
        throw e;
    } }); serial = result.catch(() => { }); return result; };
    const scope = { organizationId: release.organizationId, actorUserId: 'executor', sessionId: 'paired-session' };
    const authority = vi.fn(async () => { });
    const approval: any = { kind: 'verified_release_provider_merge_approval_v1', sourcePolicy:'expected_head_observed_base', id: 'approval-1', organizationId: release.organizationId, planId, planDigest: built.digest, executorUserId: 'executor', approverUserId: 'approver', expiresAt: '2030-01-02T01:50:00Z' };
    const readApproval = vi.fn(async () => structuredClone(approval));
    const deps: ProviderMergeDependencies = { assertCurrent: authority, readProviderApproval: readApproval, consumeProviderApproval: vi.fn(async()=>{}), now: () => new Date(now) };
    const store = createReleaseProviderMergeStore(repo, deps);
    return { now, release, connection, plan, planId, approval, scope, rows, events, repo, deps, authority, readApproval, store };
}
const receipt={repositoryFullName:'team/service',pullRequestNumber:42,headSha:'a'.repeat(40),mergeSha:'c'.repeat(40)};
it('rejects missing provider authority and simulation approvals without durable effects',async()=>{const f=fixture();await expect(createReleaseProviderMergeStore(f.repo,{...f.deps,assertCurrent:undefined}).prepare(f.scope,f.planId)).rejects.toThrow();f.approval.kind='verified_release_merge_execution_approval_v1';await expect(f.store.prepare(f.scope,f.planId)).rejects.toThrow();expect(f.rows).toHaveLength(0)});
it.each(['requester','creator','executor'])('requires genuinely independent provider approver, not %s',async actor=>{const f=fixture();f.approval.approverUserId=actor;await expect(f.store.prepare(f.scope,f.planId)).rejects.toThrow();expect(f.rows).toHaveLength(0)});
it('requires explicit observed-base source policy',async()=>{const f=fixture();delete f.approval.sourcePolicy;await expect(f.store.prepare(f.scope,f.planId)).rejects.toThrow();expect(f.rows).toHaveLength(0)});
it('claims exactly once with provider-only identity and consumes approval in the same transaction',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);expect(p).toMatchObject({mode:'provider',state:'prepared',providerWritePerformed:false});expect(p.id).toMatch(/^release_merge_provider_[a-f0-9]{64}$/);const claims=await Promise.all([f.store.claim(f.scope,p.id),f.store.claim(f.scope,p.id)]);expect(claims.filter(c=>c.claimed)).toHaveLength(1);expect(f.deps.consumeProviderApproval).toHaveBeenCalledTimes(1);expect(claims.find(c=>c.claimed)).toMatchObject({plan:f.plan.inputJson.plan});expect((await f.store.finish(f.scope,p.id,{state:'confirmed',receipt}))).toMatchObject({state:'confirmed',providerWritePerformed:true,receipt});expect((await f.store.claim(f.scope,p.id)).claimed).toBe(false)});
it('refuses mismatched receipt and retains one uncertain attempt for explicit recovery',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await f.store.claim(f.scope,p.id);await expect(f.store.finish(f.scope,p.id,{state:'confirmed',receipt:{...receipt,headSha:'d'.repeat(40)}})).rejects.toThrow();expect((await f.store.finish(f.scope,p.id,{state:'unknown'}))).toMatchObject({state:'unknown',attemptCount:1,providerWritePerformed:null});expect((await f.store.claim(f.scope,p.id)).claimed).toBe(false)});
it.each(['source','authority','lease'])('refuses late %s confirmation and cannot retry',async what=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await f.store.claim(f.scope,p.id);if(what==='source')f.release.version++;if(what==='authority')f.authority.mockRejectedValue(Error('role changed'));if(what==='lease')f.now.setTime(f.now.getTime()+31000);await expect(f.store.finish(f.scope,p.id,{state:'confirmed',receipt})).rejects.toThrow();expect((await f.store.finish(f.scope,p.id,{state:'unknown'}))).toMatchObject({state:'unknown',attemptCount:1})});
it('recovers an expired operation read-only without renewing its original lease or dispatching again',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await f.store.claim(f.scope,p.id);f.now.setTime(f.now.getTime()+31000);expect((await f.store.recover(f.scope,p.id))).toMatchObject({state:'unknown',attemptCount:1,providerWritePerformed:null});expect((await f.store.claim(f.scope,p.id)).claimed).toBe(false)});
it('requires mandatory provider approval consumption before an attempt',async()=>{const f=fixture();f.deps.consumeProviderApproval=undefined;const p=await f.store.prepare(f.scope,f.planId);await expect(f.store.claim(f.scope,p.id)).rejects.toThrow();expect(f.rows[0].attemptCount).toBe(0)});

it.each(['claim','finish'])('rolls back %s if final awaited ledger event crosses the original lease',async mode=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);if(mode==='finish')await f.store.claim(f.scope,p.id);const create=f.repo.durableAgentWorkflowEvent.create.getMockImplementation();f.repo.durableAgentWorkflowEvent.create.mockImplementation(async(args:any)=>{const r=await create(args);f.now.setTime(f.now.getTime()+31000);return r});await expect(mode==='claim'?f.store.claim(f.scope,p.id):f.store.finish(f.scope,p.id,{state:'confirmed',receipt})).rejects.toThrow();expect(f.rows[0].attemptCount).toBe(mode==='claim'?0:1);expect(f.rows[0].currentStep).toBe(mode==='claim'?'prepared':'dispatching')});
it('rejects source mutation during a final confirmation ledger write',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await f.store.claim(f.scope,p.id);const create=f.repo.durableAgentWorkflowEvent.create.getMockImplementation();f.repo.durableAgentWorkflowEvent.create.mockImplementation(async(args:any)=>{const r=await create(args);f.release.version++;return r});await expect(f.store.finish(f.scope,p.id,{state:'confirmed',receipt})).rejects.toThrow();expect(f.rows[0].currentStep).toBe('dispatching')});
it('rejects a simulated record and caller ownership or session changes without touching it',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await expect(f.store.claim({...f.scope,sessionId:'other'},p.id)).rejects.toThrow();await expect(f.store.claim(f.scope,p.id.replace('provider','sim'))).rejects.toThrow();expect(f.rows[0].attemptCount).toBe(0)});
it('refused/cancelled outcomes cannot contain receipts or reopen provider input',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await f.store.claim(f.scope,p.id);await expect(f.store.finish(f.scope,p.id,{state:'refused',receipt})).rejects.toThrow();expect((await f.store.finish(f.scope,p.id,{state:'refused'}))).toMatchObject({state:'refused',providerWritePerformed:false});expect((await f.store.claim(f.scope,p.id)).claimed).toBe(false)});
it('GET leaves expired running history untouched; explicit version-bound recovery alone records unknown',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await f.store.claim(f.scope,p.id);f.now.setTime(f.now.getTime()+31000);const before=structuredClone(f.rows),events=f.events.length;expect(await f.store.get(f.scope,p.id)).toMatchObject({state:'dispatching',version:1,attemptCount:1});expect(f.rows).toEqual(before);expect(f.events).toHaveLength(events);await expect(f.store.recover(f.scope,p.id,0)).rejects.toThrow();expect(f.rows).toEqual(before);expect(await f.store.recover(f.scope,p.id,1)).toMatchObject({state:'unknown',version:2,attemptCount:1});expect(f.events).toHaveLength(events+1)});
it('late authority loss during recovery rolls back the outcome event and state',async()=>{const f=fixture(),p=await f.store.prepare(f.scope,f.planId);await f.store.claim(f.scope,p.id);f.now.setTime(f.now.getTime()+31000);const before=structuredClone(f.rows),events=f.events.length;f.authority.mockResolvedValueOnce(undefined).mockRejectedValue(Error('session revoked'));await expect(f.store.recover(f.scope,p.id,1)).rejects.toThrow();expect(f.rows).toEqual(before);expect(f.events).toHaveLength(events)});
it('validates a prepared exact operation without a claim, write, approval consumption or lease',async()=>{
 const f=fixture(),p=await f.store.prepare(f.scope,f.planId),before=structuredClone(f.rows),events=f.events.length;
 expect(await f.store.validatePrepared(f.scope,p.id)).toEqual(f.plan.inputJson.plan);
 expect(f.readApproval).toHaveBeenLastCalledWith(expect.anything(),f.scope,f.planId,undefined);
 expect(f.rows).toEqual(before);expect(f.events).toHaveLength(events);expect(f.deps.consumeProviderApproval).not.toHaveBeenCalled();
 f.release.version++;await expect(f.store.validatePrepared(f.scope,p.id)).rejects.toThrow();
});
it('prepared validation refuses changed identity and every consumed operation',async()=>{
 const f=fixture(),p=await f.store.prepare(f.scope,f.planId);
 await expect(f.store.validatePrepared({...f.scope,sessionId:'other'},p.id)).rejects.toThrow();
 await f.store.claim(f.scope,p.id);await expect(f.store.validatePrepared(f.scope,p.id)).rejects.toThrow();
 await f.store.finish(f.scope,p.id,{state:'unknown'});await expect(f.store.validatePrepared(f.scope,p.id)).rejects.toThrow();
});
