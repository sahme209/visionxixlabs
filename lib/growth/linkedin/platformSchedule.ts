import 'server-only';
import {prisma} from '@/lib/db';
import {writeGrowthAudit} from '../audit';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {describePlatformExecution,runPlatformEffect} from '@/lib/governance/platform/effectExecution';
import {preparePlatformLinkedInSchedule,currentLinkedInVersion} from './platformPostingPlan';
import {isPostingEnabled} from './oauth';
type Input={draftId:string;connectionId:string;scheduledFor:Date;platformExecution?:object};
export async function schedulePlatformLinkedInDraft(input:Input):Promise<{kind:'scheduled'}|{kind:'governance_required'|'outcome_unknown'}>{
 const execution=input.platformExecution;if(!execution)return {kind:'governance_required'};
 let binding:ReturnType<typeof describePlatformExecution>;
 try{binding=describePlatformExecution(input.platformExecution)}catch{return {kind:'governance_required'}}
 try{
  if(!isPostingEnabled())throw Error('posting_disabled');
  const draft=await prisma.linkedInPostDraft.findUnique({where:{id:input.draftId},select:{id:true,title:true,hook:true,body:true,cta:true,hashtags:true,imageUrn:true,status:true,scheduledFor:true,updatedAt:true}});
  const connection=await prisma.linkedInAccountConnection.findUnique({where:{id:input.connectionId},select:{id:true,linkedinUrn:true,organizationUrn:true,scopes:true,status:true,expiresAt:true,updatedAt:true}});
  if(!draft||!connection)throw Error('source_unavailable');
  const prepared=preparePlatformLinkedInSchedule(draft,connection,currentLinkedInVersion(),Date.now(),input.scheduledFor);
  await runPlatformEffect(execution,prepared.effect,async beforeSend=>{
   await beforeSend();
   if(!isPostingEnabled()||currentLinkedInVersion()!==prepared.version||Date.parse(prepared.effect.target.scheduledFor)<=Date.now())throw Error('schedule_stale');
   const updated=await prisma.$transaction(async tx=>{
    const locked=await tx.$queryRawUnsafe<Array<{id:string}>>('SELECT id FROM "LinkedInPostDraft" WHERE id=$1 FOR UPDATE',draft.id);
    if(locked.length!==1)throw Error('schedule_source_unavailable');
    const assertFuture=async()=>{
     const rows=await tx.$queryRawUnsafe<Array<{now:number}>>('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::double precision AS now');
     if(rows.length!==1||!Number.isSafeInteger(rows[0].now)||Date.parse(prepared.effect.target.scheduledFor)<=rows[0].now)throw Error('schedule_stale');
    };
    await assertFuture();
    const result=await tx.linkedInPostDraft.updateMany({where:{id:draft.id,updatedAt:draft.updatedAt,status:{in:['approved','scheduled']}},data:{status:'scheduled',scheduledFor:new Date(prepared.effect.target.scheduledFor)}});
    await assertFuture();return result;
   },{isolationLevel:'ReadCommitted',timeout:10000,maxWait:5000});
   return {outcome:updated.count===1?'confirmed':'refused',value:undefined};
  });
  try{await writeGrowthAudit({actor:binding.actor,action:'draft.scheduled',targetKind:'linkedin_draft',targetId:draft.id,detail:{platformActionId:binding.actionId,scheduledFor:prepared.effect.target.scheduledFor,effectDigest:sha256ContentHash(prepared.effect)}})}catch{/* durable platform event is authoritative */}
  return {kind:'scheduled'};
 }catch{return {kind:'outcome_unknown'}}
}
