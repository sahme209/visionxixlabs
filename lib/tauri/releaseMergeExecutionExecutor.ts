import 'server-only';
import { MergeExecutionUnavailable, type MergeExecutionScope, type ReleaseMergeExecutionStore } from './releaseMergeExecutionStore';
import type { ReleaseOperationPlan } from './releaseOperationPlanContract';
export interface SimulatedMergeTransport {
    kind: 'simulated_merge_transport_v1';
    execute: (input: {
        operationId: string;
        plan: Readonly<ReleaseOperationPlan>;
        signal: AbortSignal;
    }) => Promise<{
        outcome: 'confirmed' | 'refused';
        headSha: string;
        mergeSha?: string;
    }>;
}
/** Local simulation only. No provider/client import, retries or production caller.
 * A dispatching record burns the sole attempt even if its acknowledgement is lost.
 * Restart recovery observes/marks unknown; it cannot call transport a second time.
 */
export function createReleaseMergeExecutionExecutor(store: ReleaseMergeExecutionStore, transport?: SimulatedMergeTransport) {
    return { async run(scope: MergeExecutionScope, id: string) {
            if (!transport || transport.kind !== 'simulated_merge_transport_v1')
                throw new MergeExecutionUnavailable('simulation_transport_unavailable');
            const claim = await store.claim(scope, id);
            if (!claim.claimed)
                return store.recover(scope, id);
            let plan: ReleaseOperationPlan;
            try {
                plan = await store.beforeDispatch(scope, id);
            }
            catch {
                return await store.finish(scope, id, { state: 'unknown' });
            }
            if (claim.leaseExpiresAt.getTime() <= Date.now())
                return await store.finish(scope, id, { state: 'unknown' });
            const controller = new AbortController();
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
                const result = await Promise.race([Promise.resolve().then(() => { if (controller.signal.aborted || claim.leaseExpiresAt.getTime() <= Date.now()) throw new Error('simulation_deadline_expired'); return transport.execute({ operationId: id, plan: structuredClone(plan), signal: controller.signal }); }), new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('simulation_timeout')); }, Math.max(0, Math.min(30000, claim.leaseExpiresAt.getTime() - Date.now()))); })]);
                if (result.headSha !== plan.pullRequest.headSha || !['confirmed', 'refused'].includes(result.outcome) || result.outcome === 'confirmed' && !/^[a-f0-9]{40}$/.test(result.mergeSha ?? ''))
                    return await store.finish(scope, id, { state: 'unknown' });
                return await store.finish(scope, id, { state: result.outcome === 'confirmed' ? 'simulated_confirmed' : 'simulated_refused', ...(result.outcome === 'confirmed' ? { mergeSha: result.mergeSha } : {}) });
            }
            catch {
                return await store.finish(scope, id, { state: 'unknown' });
            }
            finally {
                clearTimeout(timeout);
                controller.abort();
            }
        } };
}
