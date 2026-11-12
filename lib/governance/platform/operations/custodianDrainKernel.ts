import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest,platformCustodianRoleArn} from '../contracts';
import {readCustodianDrainPlan} from './custodianDrainContract';
const revision=z.number().int().nonnegative().max(2147483647),clock=z.number().int().nonnegative().safe();
const actionId=z.string().regex(/^platform_action_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
const custodian=z.object({accountId:z.string().regex(/^\d{12}$/),roleArn:platformCustodianRoleArn}).strict();
const barrier=z.object({format:z.literal(1),scope:z.literal('platform'),nativeKey:digest,custodian,issuerProfileDigest:digest,sourceEvidenceDigest:digest,admissionDigest:digest,generation:revision,version:revision,mode:z.enum(['draining','admitting']),controlActionId:actionId,controlDigest:digest,updatedAt:clock,executionAuthorized:z.literal(false),closureObserved:z.literal(false)}).strict();
const coordinates=z.object({nativeKey:digest,issuerProfileDigest:digest,admissionDigest:digest,generation:revision,version:revision}).strict();
export type CustodianBarrier=z.infer<typeof barrier>;
export type CustodianAdmissionCoordinates=z.infer<typeof coordinates>;
const fail=():never=>{throw Error('platform_custodian_barrier_unavailable')};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}return v}
/** Local state integrity only. Storage, current humans/source qualification and
 * original control approval/claim are the service's separate requirements. */
export function readCustodianBarrier(raw:unknown):CustodianBarrier{
 const state=barrier.parse(raw);
 if(!state.custodian.roleArn.startsWith('arn:aws:iam::'+state.custodian.accountId+':role/')||state.nativeKey!==sha256ContentHash({purpose:'platform_custodian_role_v1',custodian:state.custodian})||state.generation===0||state.version!==2*(state.generation-1)+(state.mode==='admitting'?1:0))fail();
 return freeze(state);
}
/** Pure proposed transition, NOT authority or native closure. The repository
 * must atomically compare the predecessor while consuming the original action. */
export function transitionCustodianBarrier(raw:unknown|null,rawControl:unknown,rawActionId:string,now:number):CustodianBarrier{
 const control=readCustodianDrainPlan(rawControl),id=actionId.parse(rawActionId);clock.parse(now);
 if(now>=Date.parse(control.expiresAt))fail();
 const prior=raw===null?null:readCustodianBarrier(raw);
 if(prior){
  if(prior.nativeKey!==control.nativeKey||prior.issuerProfileDigest!==control.issuerProfileDigest||prior.admissionDigest!==control.predecessorAdmissionDigest||prior.generation!==control.expectedGeneration||prior.version!==control.expectedVersion||now<prior.updatedAt||id===prior.controlActionId)fail();
 }else if(control.expectedGeneration!==0||control.expectedVersion!==null||control.operation!=='begin')fail();
 if((control.operation==='begin'&&prior?.mode==='draining')||(control.operation==='abort'&&prior?.mode!=='draining'))fail();
 return readCustodianBarrier({format:1,scope:'platform',nativeKey:control.nativeKey,custodian:control.custodian,issuerProfileDigest:control.issuerProfileDigest,sourceEvidenceDigest:control.sourceEvidenceDigest,admissionDigest:control.predecessorAdmissionDigest,generation:control.operation==='begin'?(prior?.generation??0)+1:prior!.generation,version:prior?prior.version+1:0,mode:control.operation==='begin'?'draining':'admitting',controlActionId:id,controlDigest:control.digest,updatedAt:now,executionAuthorized:false,closureObserved:false});
}
/** Checks only exact local admission coordinates. It does not establish current
 * source/fleet/credential lifetime or grant execution permission. */
export function assertCustodianAdmission(raw:unknown,rawCoordinates:unknown):void{
 const state=readCustodianBarrier(raw),selected=coordinates.parse(rawCoordinates);
 if(state.mode!=='admitting'||Object.entries(selected).some(([key,value])=>state[key as keyof CustodianBarrier]!==value))fail();
}
