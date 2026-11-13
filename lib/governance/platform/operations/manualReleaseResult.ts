import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {operationalEvidenceId} from './contracts';
import {readOperationalManifest} from './kernel';
import type {ManualReleaseRecord} from './manualReleaseStore';
const id=z.string().regex(/^dpl_[A-Za-z0-9_]{1,128}$/),stamp=z.string().max(40).datetime();
const observationSchema=z.object({deploymentId:id,receiptId:operationalEvidenceId,projectId:z.string().min(1).max(256),teamId:z.string().min(1).max(256),environment:z.literal('production'),commit:z.string().regex(/^[a-f0-9]{40}$/),providerState:z.enum(['ACCEPTED','QUEUED','BUILDING','READY','ERROR','CANCELED','UNKNOWN']),observedAt:stamp,expiresAt:stamp}).strict();
type Manifest=ManualReleaseRecord['manifest'];
export interface ManualReleaseResultView{recordId:string;manifest:Manifest;status:string;version:number;inspectedAt:number}
/** Exact read-only, bounded provider receipt supplier; not caller JSON. Actual
 * qualification is separate from structural validation. No default qualifies.
 * READY additionally requires current exact smoke/artifact/compatibility evidence.
 * Owner-entered reports cannot implement this verified-provider interface. */
export interface ManualReleaseResultSupplier{
 readExact(manifest:Manifest,deploymentId:string,signal:AbortSignal):Promise<unknown>;
 assertQualified(manifest:Manifest,observationDigest:string,signal:AbortSignal):Promise<void>;
 assertReadyEvidence(manifest:Manifest,observationDigest:string,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('manual_release_result_unavailable')};
export function createManualReleaseResultInspector(inspect:(recordId:string)=>Promise<ManualReleaseResultView>,supplier:ManualReleaseResultSupplier){
 return Object.freeze({async inspect(recordId:string,rawDeploymentId:string){
  const deploymentId=id.parse(rawDeploymentId),abort=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('manual_release_result_unavailable'))},10000)});
  try{return await Promise.race([timeout,(async()=>{
   const before=await inspect(recordId);abort.signal.throwIfAborted();
   const manifest=readOperationalManifest(before.manifest);if(manifest.kind!=='release.manual')return fail();if(!Number.isSafeInteger(before.inspectedAt)||before.inspectedAt<0||before.recordId!==recordId||!['notice_claimed','notice_recorded'].includes(before.status)||before.version!==(before.status==='notice_claimed'?2:3))fail();
   const observation=observationSchema.parse(await supplier.readExact(manifest,deploymentId,abort.signal));abort.signal.throwIfAborted();
   if(observation.deploymentId!==deploymentId||observation.projectId!==manifest.target.projectId||observation.teamId!==manifest.target.teamId||observation.environment!==manifest.target.environment||observation.commit!==manifest.source.commit)fail();
   const binding=sha256ContentHash(observation);
   await supplier.assertQualified(manifest,binding,abort.signal);abort.signal.throwIfAborted();
   if(observation.providerState==='READY'){await supplier.assertReadyEvidence(manifest,binding,abort.signal);abort.signal.throwIfAborted()}
   await supplier.assertQualified(manifest,binding,abort.signal);abort.signal.throwIfAborted();
   // This bound reader re-authenticates possession/current admin access after all
   // awaited receipt/qualification reads; it never renews the consumed notice.
   const after=await inspect(recordId);abort.signal.throwIfAborted();
   const now=after.inspectedAt;
   if(after.recordId!==before.recordId||after.version!==before.version||after.status!==before.status||sha256ContentHash(after.manifest)!==sha256ContentHash(manifest)||!Number.isSafeInteger(now)||now<0||now<before.inspectedAt||Date.parse(observation.observedAt)>now||Date.parse(observation.expiresAt)<=now||Date.parse(observation.observedAt)>=Date.parse(observation.expiresAt))fail();
   const state=observation.providerState==='READY'?'verified_ready':observation.providerState==='UNKNOWN'?'unknown':['ERROR','CANCELED'].includes(observation.providerState)?'terminal_failure':'pending';
   return Object.freeze({recordId,deploymentId,receiptId:observation.receiptId,state,providerState:observation.providerState,observedAt:observation.observedAt,reviewExpired:now>=Date.parse(manifest.expiresAt),providerExecution:false as const,executionAuthorized:false as const,rollbackAuthorized:false as const,ownerAuthorization:'external_not_verified' as const});
  })()])}catch{return fail()}finally{if(timer!==undefined)clearTimeout(timer);abort.abort()}
 }});
}
