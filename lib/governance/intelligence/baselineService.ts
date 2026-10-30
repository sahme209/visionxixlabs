import 'server-only';
import {compileBaseline,type CompiledBaseline} from './contracts';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {createGovernanceRevisionStore,RevisionScope} from './revisionStore';
import type {createGovernanceEvidencePreflight} from './evidencePreflight';
type Store=Pick<ReturnType<typeof createGovernanceRevisionStore>,'readRevision'|'propose'|'approve'|'activate'>;
/** Network preflight outside locks. Store methods still enforce current roles,
 * independent review, exact revisions, receipts and registered coverage. */
export function createGovernanceBaselineService(ports:{store:Store;preflight:Pick<ReturnType<typeof createGovernanceEvidencePreflight>,'warm'>}){
 async function warm(scope:RevisionScope,b:CompiledBaseline,signal:AbortSignal){signal.throwIfAborted();await ports.preflight.warm(scope,b,signal);signal.throwIfAborted()}
 return{
  async propose(scope:RevisionScope,raw:CompiledBaseline,nonce:string,signal:AbortSignal){const{digest,compilerVersion,...input}=raw,b=compileBaseline(input);if(sha256ContentHash(b)!==sha256ContentHash(raw))throw Error('governance_baseline_changed');await warm(scope,b,signal);return ports.store.propose(scope,b,nonce)},
  async approve(scope:RevisionScope,id:string,version:number,digest:string,nonce:string,signal:AbortSignal){signal.throwIfAborted();const{baseline}=await ports.store.readRevision(scope,id);if(baseline.digest!==digest)throw Error('governance_baseline_changed');await warm(scope,baseline,signal);return ports.store.approve(scope,id,version,digest,nonce)},
  async activate(scope:RevisionScope,id:string,parentDigest:string|null,nonce:string,signal:AbortSignal){signal.throwIfAborted();const{baseline}=await ports.store.readRevision(scope,id);if(baseline.parentDigest!==parentDigest)throw Error('governance_baseline_changed');await warm(scope,baseline,signal);return ports.store.activate(scope,id,parentDigest,nonce)},
 };
}
