import 'server-only';
import {createGovernanceAdmissionGuard,type GovernanceAdmissionContext,type GovernanceGuardPorts} from './admissionGuard';
import type {RevisionScope} from './revisionStore';
import type {createGovernanceRequestService} from './requestService';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
/** Internal server composition only. Neither HTTP input nor model output may
 * supply these ports. Existing exact-action authority remains independently
 * required, including the exact baseline digest in its human approval. */
export function createGovernanceRequestAdmission(scope:RevisionScope,service:Pick<ReturnType<typeof createGovernanceRequestService>,'readActiveEvidence'>,ports:{
 now?:()=>number;
 readCoverage:GovernanceGuardPorts['readCoverage'];
 readActionAuthority:(context:GovernanceAdmissionContext,baselineDigest:string,phase:'before_claim'|'before_write',signal:AbortSignal)=>Promise<Omit<Awaited<ReturnType<GovernanceGuardPorts['readVerifiedInputs']>>,'evidence'|'evidenceRefreshes'>>;
}){
 const owner=structuredClone(scope),proofs=new WeakMap<object,Awaited<ReturnType<typeof service.readActiveEvidence>>>();
 function bound(c:GovernanceAdmissionContext){if(c.organizationId!==owner.organizationId||c.actorUserId!==owner.actorUserId||c.sessionId!==owner.sessionId)throw Error('governance_admission_scope_changed')}
 return createGovernanceAdmissionGuard({now:ports.now??Date.now,
  async readActive(context,signal){bound(context);signal.throwIfAborted();const proof=await service.readActiveEvidence(context.scope);signal.throwIfAborted();if(proof.baseline.organizationId!==owner.organizationId||!proof.baseline.scopes.some(s=>sha256ContentHash(s)===sha256ContentHash(context.scope)))throw Error('governance_active_scope_changed');proofs.set(context,structuredClone(proof));return proof.baseline},
  async readCoverage(context,signal){bound(context);signal.throwIfAborted();return ports.readCoverage(context,signal)},
  async readVerifiedInputs(context,baseline,phase,signal){bound(context);const proof=proofs.get(context);proofs.delete(context);const now=(ports.now??Date.now)();if(!proof||proof.baseline.digest!==baseline.digest||!Number.isFinite(now)||proof.expiresAt<=now)throw Error('governance_active_proof_unavailable');const authority=await ports.readActionAuthority(context,baseline.digest,phase,signal);signal.throwIfAborted();if(proof.expiresAt<=(ports.now??Date.now)())throw Error('governance_active_proof_expired');return{...authority,evidence:proof.evidence,evidenceRefreshes:proof.evidenceRefreshes}},
 });
}
