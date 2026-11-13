import {readDefaultImagePublicationSource} from './platformImageSource';
/** Platform-governed LinkedIn publication. Exact account/content, no latest
 * account fallback, no automatic replay, no raw provider errors in storage. */
import 'server-only';
import {prisma} from '@/lib/db';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {decryptCredential} from '@/lib/security/credentialVault';
import {describePlatformExecution,runPlatformEffect} from '@/lib/governance/platform/effectExecution';
import {readBoundedPlatformJson} from '@/lib/governance/platform/httpResponse';
import {isPostingEnabled} from './oauth';
import {writeGrowthAudit} from '../audit';
import {preparePlatformLinkedInPost,currentLinkedInVersion} from './platformPostingPlan';
export {renderPostText} from './platformPostingPlan';
const POSTS_URL='https://api.linkedin.com/rest/posts';
export const POST_DRAFT_SELECT={id:true,title:true,hook:true,body:true,cta:true,hashtags:true,imageUrn:true,status:true,scheduledFor:true,updatedAt:true} as const;
export const POST_CONNECTION_SELECT={id:true,linkedinUrn:true,organizationUrn:true,scopes:true,status:true,expiresAt:true,updatedAt:true} as const;
export type PublishOutcome=
 |{kind:'success';urn:string;url?:string;runId:string|null;recordingConfirmed:boolean}
 |{kind:'skipped_disabled'|'skipped_not_connected'|'token_expired'|'governance_required'|'outcome_unknown';runId:string|null}
 |{kind:'http_error';status:number;body:string;runId:string|null}
 |{kind:'network_error';message:string;runId:string|null};
export interface PublishInput{draftId:string;triggeredBy:string;connectionId?:string;platformExecution?:object;effectId?:string}
async function metadata(draftId:string,connectionId:string){
 const draft=await prisma.linkedInPostDraft.findUnique({where:{id:draftId},select:POST_DRAFT_SELECT});
 const connection=await prisma.linkedInAccountConnection.findUnique({where:{id:connectionId},select:POST_CONNECTION_SELECT});
 return {draft,connection,...(draft&&connection&&draft.imageUrn!==null?{imageLineage:await readDefaultImagePublicationSource(connection,draft.imageUrn)}:{})};
}
async function recordRun(draftId:string,actor:string,outcome:'success'|'failed'|'unknown',data:{httpStatus?:number;linkedinPostUrn?:string;errorDetail?:string;diagnosticsJson?:{platformActionId:string}}){
 try{return (await prisma.linkedInPostPublishRun.create({data:{draftId,triggeredBy:actor,outcome,...data,finishedAt:new Date()}})).id}catch{return null}
}
const validUrn=(value:unknown):value is string=>typeof value==='string'&&/^urn:li:(share|ugcPost):[A-Za-z0-9_-]{1,128}$/.test(value);
export async function publishDraft(input:PublishInput):Promise<PublishOutcome>{
 if(!isPostingEnabled())return {kind:'skipped_disabled',runId:null};
 const {draftId,connectionId,platformExecution,effectId}=input;
 let binding:ReturnType<typeof describePlatformExecution>;
 try{binding=describePlatformExecution(platformExecution)}catch{return {kind:'governance_required',runId:null}}
 if(!connectionId||!platformExecution)return {kind:'governance_required',runId:null};
 let credentialUnavailable=false;
 try{
  const source=await metadata(draftId,connectionId);
  if(!source.draft)return {kind:'http_error',status:404,body:'draft_not_found',runId:null};
  if(!source.connection)return {kind:'skipped_not_connected',runId:null};
  const draft=source.draft,connection=source.connection,prepared=preparePlatformLinkedInPost(draft,connection,currentLinkedInVersion(),Date.now(),effectId,source.imageLineage);
  const receipt=await runPlatformEffect(platformExecution,prepared.effect,async beforeSend=>{
   const stored=await prisma.linkedInAccountConnection.findUnique({where:{id:connectionId},select:{accessToken:true,updatedAt:true}});
   if(!stored||stored.updatedAt.getTime()!==connection.updatedAt.getTime())throw Error('posting_source_changed');
   let accessToken:string;
   try{accessToken=decryptCredential(stored.accessToken)}catch{
    credentialUnavailable=true;
    try{await prisma.linkedInAccountConnection.updateMany({where:{id:connectionId,updatedAt:connection.updatedAt,status:'connected'},data:{status:'expired',lastError:'Stored credential could not be decrypted; reconnect required.'}})}catch{/* no provider send; original claim remains */}
    throw Error('posting_credential_unavailable');
   }
   const latest=await metadata(draftId,connectionId);
   if(!latest.draft||!latest.connection||sha256ContentHash(preparePlatformLinkedInPost(latest.draft,latest.connection,currentLinkedInVersion(),Date.now(),effectId,latest.imageLineage).effect)!==sha256ContentHash(prepared.effect))throw Error('posting_source_changed');
   await beforeSend();
   if(!isPostingEnabled()||currentLinkedInVersion()!==prepared.version)throw Error('posting_policy_changed');
   const signal=AbortSignal.timeout(15000),response=await fetch(POSTS_URL,{method:'POST',redirect:'error',signal,cache:'no-store',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json','LinkedIn-Version':prepared.version,'X-Restli-Protocol-Version':'2.0.0'},body:prepared.body});
   if(!response.ok)throw Error('posting_response_unconfirmed');
   let urn:unknown=response.headers.get('x-restli-id');
   if(!validUrn(urn)){const raw=await readBoundedPlatformJson(response,signal);urn=raw&&typeof raw==='object'&&!Array.isArray(raw)?(raw as {id?:unknown}).id:null}
   else{void response.body?.cancel().catch(()=>{})}
   if(!validUrn(urn))throw Error('posting_identity_unconfirmed');
   return {outcome:'confirmed',value:{urn,status:response.status}};
  });
  // A known remote post remains known even if local bookkeeping fails.
  let recordingConfirmed=true;
  try{const updated=await prisma.linkedInPostDraft.updateMany({where:{id:draftId,updatedAt:draft.updatedAt,status:{in:['approved','scheduled']}},data:{status:'published',publishedAt:new Date(),linkedinPostUrn:receipt.urn}});if(updated.count!==1)recordingConfirmed=false}catch{recordingConfirmed=false}
  try{const updated=await prisma.linkedInAccountConnection.updateMany({where:{id:connectionId,updatedAt:connection.updatedAt,status:'connected'},data:{lastUsedAt:new Date(),lastError:null}});if(updated.count!==1)recordingConfirmed=false}catch{recordingConfirmed=false}
  const runId=await recordRun(draftId,binding.actor,'success',{httpStatus:receipt.status,linkedinPostUrn:receipt.urn,diagnosticsJson:{platformActionId:binding.actionId}});if(!runId)recordingConfirmed=false;
  try{await writeGrowthAudit({actor:binding.actor,action:'draft.publish_succeeded',targetKind:'linkedin_draft',targetId:draftId,detail:{urn:receipt.urn,platformActionId:binding.actionId,recordingConfirmed}})}catch{/* platform transition is authoritative */}
  return {kind:'success',urn:receipt.urn,runId,recordingConfirmed};
 }catch{
  const runId=await recordRun(draftId,binding.actor,credentialUnavailable?'failed':'unknown',{errorDetail:credentialUnavailable?'posting_credential_unavailable':'posting_outcome_unconfirmed',diagnosticsJson:{platformActionId:binding.actionId}});
  // Never reset a scheduled draft into a retry path after an uncertain send.
  return {kind:credentialUnavailable?'token_expired':'outcome_unknown',runId};
 }
}
