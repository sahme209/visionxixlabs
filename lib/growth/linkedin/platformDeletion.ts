import 'server-only';
import {prisma} from '@/lib/db';
import {decryptCredential} from '@/lib/security/credentialVault';
import {describePlatformExecution,runPlatformEffect} from '@/lib/governance/platform/effectExecution';
import {preparePlatformLinkedInDeletion} from './platformDeletionPlan';
import {readPlatformDeletionSource} from './platformDeletionSource';
import {currentLinkedInVersion} from './platformPostingPlan';
import {isPostingEnabled} from './oauth';
import {writeGrowthAudit} from '../audit';
export async function deletePlatformLinkedInPost(input:{draftId:string;connectionId:string;platformExecution?:object}):Promise<{kind:'deleted'|'governance_required'|'outcome_unknown'}>{
 const {draftId,connectionId}=input;
 const execution=input.platformExecution;if(!execution)return {kind:'governance_required'};
 let metadata:ReturnType<typeof describePlatformExecution>;
 try{metadata=describePlatformExecution(execution)}catch{return {kind:'governance_required'}}
 try{
  if(!isPostingEnabled())throw Error('posting_disabled');
  const source=await prisma.$transaction(tx=>readPlatformDeletionSource(tx,draftId,connectionId),{isolationLevel:'ReadCommitted',timeout:10000,maxWait:5000});
  const prepared=preparePlatformLinkedInDeletion(source,currentLinkedInVersion(),Date.now());
  await runPlatformEffect(execution,prepared.effect,async beforeSend=>{
   const stored=await prisma.linkedInAccountConnection.findUnique({where:{id:prepared.effect.target.connectionId},select:{accessToken:true,updatedAt:true}});
   if(!stored)throw Error('credential_unavailable');
   if(stored.updatedAt.getTime()!==prepared.connectionUpdatedAt)throw Error('credential_changed');
   const token=decryptCredential(stored.accessToken);if(!token)throw Error('credential_unavailable');
   await beforeSend();if(!isPostingEnabled()||currentLinkedInVersion()!==prepared.effect.target.apiVersion)throw Error('deletion_stale');
   const result=await fetch(prepared.url,{method:'DELETE',headers:{Authorization:'Bearer '+token,'LinkedIn-Version':prepared.effect.target.apiVersion,'X-Restli-Protocol-Version':'2.0.0'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   return {outcome:result.status===204?'confirmed':'unknown',value:undefined};
  });
  // Preserve original successful publication and URN. Deletion is a new
  // historical effect, never a failed/pending draft or permission to republish.
  try{await writeGrowthAudit({actor:metadata.actor,action:'draft.deleted',targetKind:'linkedin_draft',targetId:prepared.effect.target.draftId,detail:{platformActionId:metadata.actionId,postUrn:prepared.effect.target.postUrn}})}catch{/* durable platform event is authoritative */}
  return {kind:'deleted'};
 }catch{return {kind:'outcome_unknown'}}
}
