import 'server-only';

type MutationStore={claim:(...args:any[])=>Promise<unknown>;beforeDispatch:(...args:any[])=>Promise<unknown>};
/** Only trusted server composition supplies this fence. Keep existing durable
 * authority, approval consumption and outcomes intact. No enrollment result
 * grants permission. Reads, cancellation and unknown-outcome recovery retain
 * their original methods. The fence itself performs no provider I/O. */
export function fenceUncoveredMutationStore<T extends MutationStore>(store:T,assertUnenrolled:()=>Promise<void>):T{
 return {...store,
  claim:async(...args:Parameters<T['claim']>)=>{await assertUnenrolled();return store.claim(...args)},
  beforeDispatch:async(...args:Parameters<T['beforeDispatch']>)=>{const exact=await store.beforeDispatch(...args);await assertUnenrolled();return exact},
 } as T;
}
