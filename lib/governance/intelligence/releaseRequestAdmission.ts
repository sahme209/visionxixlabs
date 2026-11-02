import 'server-only';
import {createReleaseGovernanceAdmissionGuard,type ReleaseGovernanceGuardPorts,type ReleaseClaimReceipt,type ReleaseWriteReceipt} from './releaseAdmissionGuard';
import type {GovernanceAdmissionContext,GovernanceAdmissionReceipt} from './admissionGuard';
import type {RevisionScope} from './revisionStore';
import type {createGovernanceRequestService} from './requestService';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
type ClaimInputs=Awaited<ReturnType<ReleaseGovernanceGuardPorts['readClaimInputs']>>;
type WriteInputs=Awaited<ReturnType<ReleaseGovernanceGuardPorts['readWriteInputs']>>;
export type ReleaseRequestActionAuthority=Omit<ClaimInputs,'evidence'|'evidenceRefreshes'>|Omit<WriteInputs,'evidence'|'evidenceRefreshes'>;
/** Actual trusted request composition; no source, coverage or provider permission
 * comes from HTTP/model data. Phase adapters preserve the SAME private receipt. */
export function createGovernanceReleaseRequestAdmission(scope:RevisionScope,service:Pick<ReturnType<typeof createGovernanceRequestService>,'readActiveEvidence'>,ports:{now?:()=>number;readCoverage:ReleaseGovernanceGuardPorts['readCoverage'];readActionAuthority(context:GovernanceAdmissionContext,baselineDigest:string,phase:'before_claim'|'before_write',signal:AbortSignal):Promise<ReleaseRequestActionAuthority>}){
 const owner=structuredClone(scope),proofs=new WeakMap<object,Awaited<ReturnType<typeof service.readActiveEvidence>>>(),now=ports.now??Date.now;
 function bound(c:GovernanceAdmissionContext){if(c.organizationId!==owner.organizationId||c.actorUserId!==owner.actorUserId||c.sessionId!==owner.sessionId)throw Error('governance_release_admission_scope_changed')}
 async function readInputs(context:GovernanceAdmissionContext,baseline:Parameters<ReleaseGovernanceGuardPorts['readClaimInputs']>[1],phase:'before_claim'|'before_write',signal:AbortSignal){
  bound(context);const proof=proofs.get(context);proofs.delete(context);
  const fresh=()=>{signal.throwIfAborted();const at=now();if(!proof||proof.baseline.digest!==baseline.digest||!Number.isFinite(at)||proof.expiresAt<=at)throw Error('governance_active_proof_unavailable')};fresh();
  const authority=await ports.readActionAuthority(context,baseline.digest,phase,signal);fresh();
  if(phase==='before_claim'&&(!('providerEligibilityVerified'in authority)||authority.providerAuthority?.kind!=='release_provider_eligibility_v1')||phase==='before_write'&&(!('providerAccessVerified'in authority)||authority.providerAuthority?.kind!=='release_provider_write_v1'))throw Error('governance_release_provider_phase_changed');
  const providerFresh=authority.providerAuthority.assertFresh;if(typeof providerFresh!=='function')throw Error('governance_release_provider_proof_unavailable');
  return{...authority,evidence:proof!.evidence,evidenceRefreshes:proof!.evidenceRefreshes,providerAuthority:{kind:authority.providerAuthority.kind,assertFresh:()=>{fresh();if(providerFresh()!==undefined)throw Error('governance_release_provider_proof_unavailable');signal.throwIfAborted()}}};
 }
 const guard=createReleaseGovernanceAdmissionGuard({now,
  async readActive(context,signal){bound(context);signal.throwIfAborted();const proof=await service.readActiveEvidence(context.scope);signal.throwIfAborted();if(proof.baseline.organizationId!==owner.organizationId||!proof.baseline.scopes.some(s=>hash(s)===hash(context.scope)))throw Error('governance_active_scope_changed');proofs.set(context,structuredClone(proof));return proof.baseline},
  async readCoverage(context,signal){bound(context);signal.throwIfAborted();return ports.readCoverage(context,signal)},
  async readClaimInputs(context,baseline,signal){return await readInputs(context,baseline,'before_claim',signal) as ClaimInputs},
  async readWriteInputs(context,baseline,signal){return await readInputs(context,baseline,'before_write',signal) as WriteInputs},
 });
 return{assertClaimFresh:guard.assertClaimFresh,async assert(raw:unknown,phase:'before_claim'|'before_write',prior?:GovernanceAdmissionReceipt,parent?:AbortSignal):Promise<ReleaseClaimReceipt|ReleaseWriteReceipt>{if(phase==='before_claim')return guard.assertClaim(raw,parent);if(phase==='before_write')return guard.assertWrite(raw,prior,parent);throw Error('governance_release_admission_unavailable')}};
}
