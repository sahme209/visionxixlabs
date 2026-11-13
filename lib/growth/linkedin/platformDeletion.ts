import 'server-only';
import {prisma} from '@/lib/db';
import {describePlatformExecution,runPlatformEffect,readPlatformGrowthTransport} from '@/lib/governance/platform/effectExecution';
import {preparePlatformLinkedInDeletion} from './platformDeletionPlan';
import {readPlatformDeletionSource} from './platformDeletionSource';
import {currentLinkedInVersion} from './platformPostingPlan';
import {isPostingEnabled} from './oauth';
import {writeGrowthAudit} from '../audit';
export async function deletePlatformLinkedInPost(input:{draftId:string;connectionId:string;platformExecution?:object;effectId?:string}):Promise<{kind:'deleted'|'governance_required'|'outcome_unknown'}>{
 const {draftId,connectionId,effectId}=input;
 const execution=input.platformExecution;if(!execution)return {kind:'governance_required'};
 let metadata:ReturnType<typeof describePlatformExecution>,native:ReturnType<typeof readPlatformGrowthTransport>;
 try{metadata=describePlatformExecution(execution);native=readPlatformGrowthTransport(execution)}catch{return {kind:'governance_required'}}
 try{
  if(!isPostingEnabled())throw Error('posting_disabled');
  const source=await prisma.$transaction(tx=>readPlatformDeletionSource(tx,draftId,connectionId),{isolationLevel:'ReadCommitted',timeout:10000,maxWait:5000});
  const prepared=preparePlatformLinkedInDeletion(source,currentLinkedInVersion(),Date.now(),effectId);
  await runPlatformEffect(execution,prepared.effect,async(beforeSend,beforeCredential,credentialCurrent)=>{
   const result=await native.send(prepared.effect,{kind:'delete',source,version:prepared.effect.target.apiVersion},beforeSend,beforeCredential,credentialCurrent);
   if(result.kind!=='deleted')throw Error('deletion_unconfirmed');return {outcome:'confirmed',value:undefined};
  });
  // Preserve original successful publication and URN. Deletion is a new
  // historical effect, never a failed/pending draft or permission to republish.
  try{await writeGrowthAudit({actor:metadata.actor,action:'draft.deleted',targetKind:'linkedin_draft',targetId:prepared.effect.target.draftId,detail:{platformActionId:metadata.actionId,postUrn:prepared.effect.target.postUrn}})}catch{/* durable platform event is authoritative */}
  return {kind:'deleted'};
 }catch{return {kind:'outcome_unknown'}}
}
