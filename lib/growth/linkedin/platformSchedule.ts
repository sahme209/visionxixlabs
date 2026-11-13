import {readDefaultImagePublicationSource} from './platformImageSource';
import 'server-only';
import {prisma} from '@/lib/db';
import {writeGrowthAudit} from '../audit';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {describePlatformExecution,runPlatformEffect} from '@/lib/governance/platform/effectExecution';
import {preparePlatformLinkedInSchedule,currentLinkedInVersion} from './platformPostingPlan';
import {isPostingEnabled} from './oauth';
type Input={imageUploadActionId?:string;draftId:string;connectionId:string;scheduledFor:Date;platformExecution?:object;effectId?:string};
export async function schedulePlatformLinkedInDraft(input:Input):Promise<{kind:'scheduled'}|{kind:'governance_required'|'outcome_unknown'}>{
 const {draftId,connectionId,effectId}=input;
 const execution=input.platformExecution;if(!execution)return {kind:'governance_required'};
 let binding:ReturnType<typeof describePlatformExecution>;
 try{binding=describePlatformExecution(execution)}catch{return {kind:'governance_required'}}
 try{
  const scheduledFor=new Date(input.scheduledFor.getTime());
  if(!isPostingEnabled())throw Error('posting_disabled');
  const draft=await prisma.linkedInPostDraft.findUnique({where:{id:draftId},select:{id:true,title:true,hook:true,body:true,cta:true,hashtags:true,imageUrn:true,status:true,scheduledFor:true,updatedAt:true}});
  const connection=await prisma.linkedInAccountConnection.findUnique({where:{id:connectionId},select:{id:true,linkedinUrn:true,organizationUrn:true,scopes:true,status:true,expiresAt:true,updatedAt:true}});
  if(!draft||!connection)throw Error('source_unavailable');
  const imageLineage=await readDefaultImagePublicationSource(connection,draft.imageUrn,input.imageUploadActionId);
  const prepared=preparePlatformLinkedInSchedule(draft,connection,currentLinkedInVersion(),Date.now(),scheduledFor,effectId,imageLineage,input.imageUploadActionId);
  await runPlatformEffect(execution,prepared.effect,async beforeSend=>{
   await beforeSend();
   if(!isPostingEnabled()||currentLinkedInVersion()!==prepared.version||Date.parse(prepared.effect.target.scheduledFor)<=Date.now())throw Error('schedule_stale');
   // The bound original action/child transaction applies the fixed schedule
   // update and post-write authority/time checks before acknowledging this call.
   return {outcome:'confirmed',value:undefined};
  });
  try{await writeGrowthAudit({actor:binding.actor,action:'draft.scheduled',targetKind:'linkedin_draft',targetId:draft.id,detail:{platformActionId:binding.actionId,scheduledFor:prepared.effect.target.scheduledFor,effectDigest:sha256ContentHash(prepared.effect)}})}catch{/* durable platform event is authoritative */}
  return {kind:'scheduled'};
 }catch{return {kind:'outcome_unknown'}}
}
