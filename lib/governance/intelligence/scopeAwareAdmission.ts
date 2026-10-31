import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseGovernanceAdmissionContext,type GovernanceAdmissionContext,type GovernanceAdmissionReceipt,createGovernanceAdmissionGuard} from './admissionGuard';
import type {RevisionScope} from './revisionStore';
/** Server-only transition fence. An authenticated, positively absent enrollment
 * keeps existing executor authority; any enrollment transition requires a new
 * exact decision. No error or unknown record can mean legacy permission. */
export function createScopeAwareGovernanceAdmission(scope:RevisionScope,ports:{
 now?:()=>number;
 readEnrollment(context:GovernanceAdmissionContext,signal:AbortSignal):Promise<{enrolled:false}|{enrolled:true;baselineDigest:string}>;
 guard:ReturnType<typeof createGovernanceAdmissionGuard>;
}){
 const owner=structuredClone(scope),issued=new WeakMap<GovernanceAdmissionReceipt,{digest:string;enrolled:boolean;receiptDigest:string}>(),now=ports.now??Date.now;
 return{async assert(raw:unknown,phase:'before_claim'|'before_write',prior?:GovernanceAdmissionReceipt,parent?:AbortSignal){
  try{
   const signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]),context=parseGovernanceAdmissionContext(raw),digest=sha256ContentHash(context),started=now();signal.throwIfAborted();
   if(!Number.isFinite(started)||context.organizationId!==owner.organizationId||context.actorUserId!==owner.actorUserId||context.sessionId!==owner.sessionId||!['before_claim','before_write'].includes(phase))throw Error();
   const original=prior?issued.get(prior):undefined;if(phase==='before_write'&&(!prior||!original||original.digest!==digest||original.receiptDigest!==sha256ContentHash(prior)||prior.phase!=='before_claim'||started<prior.checkedAt||started-prior.checkedAt>15000))throw Error();
   const enrollment=await withGithubAbort(ports.readEnrollment(context,signal),signal);signal.throwIfAborted();
   if(enrollment.enrolled!==true&&enrollment.enrolled!==false||original&&original.enrolled!==enrollment.enrolled)throw Error();
   let receipt:GovernanceAdmissionReceipt;
   if(enrollment.enrolled){if(!/^[a-f0-9]{64}$/.test(enrollment.baselineDigest)||prior&&prior.baselineDigest!==enrollment.baselineDigest)throw Error();receipt=await ports.guard.assert(context,phase,prior,signal);if(receipt.baselineDigest!==enrollment.baselineDigest)throw Error()}
   else receipt={baselineDigest:'0'.repeat(64),contextDigest:digest,phase,checkedAt:now()};
   const finished=now();signal.throwIfAborted();if(!Number.isFinite(finished)||finished<started||finished-started>15000||prior&&(finished<prior.checkedAt||finished-prior.checkedAt>15000))throw Error();
   if(receipt.contextDigest!==digest||receipt.phase!==phase||!Number.isFinite(receipt.checkedAt))throw Error();issued.set(receipt,{digest,enrolled:enrollment.enrolled,receiptDigest:sha256ContentHash(receipt)});return receipt;
  }catch{throw Error('governance_admission_unavailable')}
 }};
}
