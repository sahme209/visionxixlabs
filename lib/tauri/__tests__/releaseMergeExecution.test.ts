import { expect, it, vi } from 'vitest';
import { buildReleaseMergePlan } from '../releaseMergePlan';
import { sha256ContentHash } from '../contentHash';
import { completeReleaseIntake } from './fixtures/completeReleaseIntake';
import { releaseOperationPlanId } from '@/lib/agent/workflows/releaseOperationPlanStore';
import { createReleaseMergeExecutionStore, type MergeExecutionDependencies } from '../releaseMergeExecutionStore';
import { createReleaseMergeExecutionExecutor } from '../releaseMergeExecutionExecutor';
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
    const approval: any = { kind: 'verified_release_merge_execution_approval_v1', id: 'approval-1', organizationId: release.organizationId, planId, planDigest: built.digest, executorUserId: 'executor', approverUserId: 'approver', expiresAt: '2030-01-02T01:50:00Z' };
    const readApproval = vi.fn(async () => structuredClone(approval));
    const deps: MergeExecutionDependencies = { assertCurrent: authority, readExecutableApproval: readApproval, consumeExecutableApproval: vi.fn(async()=>{}), now: () => new Date(now) };
    const store = createReleaseMergeExecutionStore(repo, deps);
    const transport = { kind: 'simulated_merge_transport_v1' as const, execute: vi.fn(async () => ({ outcome: 'confirmed' as const, headSha: built.plan.pullRequest.headSha, mergeSha: 'c'.repeat(40) })) };
    const executor = createReleaseMergeExecutionExecutor(store, transport);
    return { now, release, connection, plan, planId, approval, scope, rows, events, repo, deps, authority, readApproval, store, transport, executor };
}
it('refuses absent independent executable approval before any durable claim or simulated transport', async () => { const f = fixture(); const store = createReleaseMergeExecutionStore(f.repo, { ...f.deps, readExecutableApproval: undefined }); await expect(store.prepare(f.scope, f.planId)).rejects.toMatchObject({ code: 'approval_unavailable' }); expect(f.rows).toHaveLength(0); expect(f.transport.execute).not.toHaveBeenCalled(); });
it.each(['requester', 'creator', 'executor'])('refuses self approval by %s', async (actor) => { const f = fixture(); f.approval.approverUserId = actor; await expect(f.store.prepare(f.scope, f.planId)).rejects.toThrow(); expect(f.rows).toHaveLength(0); });
it('binds an immutable simulation and dispatches once despite replay/concurrent starts', async () => { const f = fixture(); const prepared = await f.store.prepare(f.scope, f.planId); expect(prepared).toMatchObject({ state: 'prepared', attemptCount: 0, simulationOnly: true, executionAuthorized: false, providerWritePerformed: false }); const results = await Promise.all([f.executor.run(f.scope, prepared.id), f.executor.run(f.scope, prepared.id)]); expect(f.transport.execute).toHaveBeenCalledTimes(1); expect(results.some(r => r.state === 'simulated_confirmed')).toBe(true); expect((await f.executor.run(f.scope, prepared.id)).attemptCount).toBe(1); expect(f.transport.execute).toHaveBeenCalledTimes(1); });
it('does not interpret advisory reviewed state as executable approval', async () => { const f = fixture(); f.readApproval.mockResolvedValue(null); await expect(f.store.prepare(f.scope, f.planId)).rejects.toThrow(); expect(f.rows).toHaveLength(0); });
it.each(['release', 'connection', 'expiry', 'authority', 'approval'])('refuses changed %s before dispatch', async (what) => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); if (what === 'release')
    f.release.version++; if (what === 'connection')
    f.connection.status = 'suspended'; if (what === 'expiry')
    f.now.setTime(Date.parse('2030-01-02T02:01:00Z')); if (what === 'authority')
    f.authority.mockRejectedValue(Error('revoked')); if (what === 'approval')
    f.approval.planDigest = 'd'.repeat(64); await expect(f.executor.run(f.scope, p.id)).rejects.toThrow(); expect(f.transport.execute).not.toHaveBeenCalled(); expect(f.rows[0].attemptCount).toBe(0); });
it('unknown transport cannot be replayed after restart or reconciled into a resend', async () => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); f.transport.execute.mockRejectedValue(Error('lost acknowledgment')); expect((await f.executor.run(f.scope, p.id)).state).toBe('unknown'); const restarted = createReleaseMergeExecutionExecutor(createReleaseMergeExecutionStore(f.repo, f.deps), f.transport); expect((await restarted.run(f.scope, p.id)).state).toBe('unknown'); expect(f.transport.execute).toHaveBeenCalledTimes(1); });
it('cancellation before dispatch prevents any attempt', async () => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); expect((await f.store.cancel(f.scope, p.id)).state).toBe('cancelled'); expect((await f.executor.run(f.scope, p.id)).state).toBe('cancelled'); expect(f.transport.execute).not.toHaveBeenCalled(); });
it('receipt head mismatch records unknown rather than confirmation or retry', async () => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); f.transport.execute.mockResolvedValue({ outcome: 'confirmed', headSha: 'f'.repeat(40), mergeSha: 'c'.repeat(40) }); expect((await f.executor.run(f.scope, p.id)).state).toBe('unknown'); expect(f.transport.execute).toHaveBeenCalledTimes(1); });
it('never invokes an absent or non-simulated transport', async () => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); await expect(createReleaseMergeExecutionExecutor(f.store, undefined).run(f.scope, p.id)).rejects.toThrow(); expect(f.rows[0].attemptCount).toBe(0); });
it('does not mint a second operation for a new session or approval on the same plan', async () => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); await f.executor.run(f.scope, p.id); await expect(f.store.prepare({ ...f.scope, sessionId: 'new-session' }, f.planId)).rejects.toThrow(); f.approval.id = 'new-approval'; await expect(f.store.prepare(f.scope, f.planId)).rejects.toThrow(); expect(f.rows).toHaveLength(1); expect(f.transport.execute).toHaveBeenCalledTimes(1); });
it.each(['source', 'authority', 'deadline'])('late %s change withholds simulated confirmation and burns the attempt', async (what) => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); f.transport.execute.mockImplementation(async () => { if (what === 'source')
    f.release.version++; if (what === 'authority')
    f.authority.mockRejectedValue(Error('revoked')); if (what === 'deadline')
    f.now.setTime(f.now.getTime() + 31000); return { outcome: 'confirmed', headSha: 'a'.repeat(40), mergeSha: 'c'.repeat(40) }; }); expect((await f.executor.run(f.scope, p.id)).state).toBe('unknown'); expect(f.rows[0].attemptCount).toBe(1); expect(f.events.at(-1).eventType).toBe('release_merge_sim.unknown'); });
it('a lost claim acknowledgment cannot dispatch or reclaim the operation', async () => { const f = fixture(); const p = await f.store.prepare(f.scope, f.planId); const transaction = f.repo.$transaction; f.repo.$transaction = async (fn: any) => { await transaction(fn); throw Error('lost claim acknowledgment'); }; await expect(f.executor.run(f.scope, p.id)).rejects.toThrow(); expect(f.transport.execute).not.toHaveBeenCalled(); f.repo.$transaction = transaction; expect((await f.executor.run(f.scope, p.id)).state).toBe('dispatching'); f.now.setTime(f.now.getTime() + 31000); expect((await f.store.recover(f.scope, p.id)).state).toBe('unknown'); expect(f.transport.execute).not.toHaveBeenCalled(); });
it('an uncooperative simulated transport times out once and ignores a late success', async () => { vi.useFakeTimers(); try {
    const f = fixture();
    vi.setSystemTime(f.now);
    const p = await f.store.prepare(f.scope, f.planId);
    let resolve!: (v: any) => void;
    f.transport.execute.mockImplementation(() => new Promise(r => { resolve = r; }));
    const pending = f.executor.run(f.scope, p.id);
    await vi.advanceTimersByTimeAsync(30001);
    expect((await pending).state).toBe('unknown');
    resolve({ outcome: 'confirmed', headSha: 'a'.repeat(40), mergeSha: 'c'.repeat(40) });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.rows[0].currentStep).toBe('unknown');
    expect(f.transport.execute).toHaveBeenCalledTimes(1);
}
finally {
    vi.useRealTimers();
} });
it('does not create records without a current authority verifier', async () => { const f = fixture(); const store = createReleaseMergeExecutionStore(f.repo, { ...f.deps, assertCurrent: undefined }); await expect(store.prepare(f.scope, f.planId)).rejects.toMatchObject({ code: 'authority_unavailable' }); expect(f.rows).toHaveLength(0); });
it('does not invoke transport when the claim lease expires after preflight returns',async()=>{vi.useFakeTimers();try{const f=fixture();vi.setSystemTime(f.now);const p=await f.store.prepare(f.scope,f.planId);const before=f.store.beforeDispatch;let entered!:()=>void;const ready=new Promise<void>(r=>{entered=r});let resume!:()=>void;f.store.beforeDispatch=async(...args)=>{const plan=await before(...args);entered();await new Promise<void>(r=>{resume=r});return plan};const pending=f.executor.run(f.scope,p.id);await ready;await vi.advanceTimersByTimeAsync(31000);resume();expect((await pending).state).toBe('unknown');expect(f.transport.execute).not.toHaveBeenCalled()}finally{vi.useRealTimers()}});
