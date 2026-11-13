import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {isPostingEnabled} from '@/lib/growth/linkedin/oauth';
import {preparePlatformLinkedInPost,preparePlatformLinkedInSchedule,currentLinkedInVersion,postingDraftSchema,postingConnectionSchema,postingSourceSchema} from '@/lib/growth/linkedin/platformPostingPlan';
import {preparePlatformLinkedInDeletion} from '@/lib/growth/linkedin/platformDeletionPlan';
import {compilePlatformPlan} from './kernel';
import type {PlatformTransaction} from './actionStore';
import {growthPreparationSelection} from './preparationContract';
export {growthPreparationSelection} from './preparationContract';
const fail=():never=>{throw Error('platform_growth_preparation_unavailable')};
/** Derives data-source identity, not native runtime/issuer qualification.
 * No stored/decrypted credential enters the plan, digest or preview. */
export async function prepareGrowthPlatformPlan(tx:PlatformTransaction,raw:unknown,now:number,effectId?:string){
 const selection=growthPreparationSelection.parse(raw),version=currentLinkedInVersion();
 if(!Number.isSafeInteger(now)||now<0||!isPostingEnabled())fail();
 let effect,connectionExpires:number,sourceNotBefore:number,renderedPost:string|undefined;
 if(selection.operation==='delete'){
  const read=tx.readGrowthDeletionSource??fail(),source=await read.call(tx,selection.draftId,selection.connectionId),prepared=preparePlatformLinkedInDeletion(source,version,now,effectId);
  effect=prepared.effect;
  const parsed=z.object({connection:postingConnectionSchema,draft:z.object({updatedAt:z.date()}).passthrough()}).passthrough().parse(source);connectionExpires=parsed.connection.expiresAt.getTime();sourceNotBefore=Math.max(parsed.connection.updatedAt.getTime(),parsed.draft.updatedAt.getTime());
 }else{
  const source=postingSourceSchema.parse((selection.imageUploadActionId===undefined?await tx.readGrowthPostingSource(selection.draftId,selection.connectionId):await tx.readGrowthPostingSource(selection.draftId,selection.connectionId,selection.imageUploadActionId)));
  const post=preparePlatformLinkedInPost(source.draft,source.connection,version,now,effectId,source.imageLineage,selection.imageUploadActionId);renderedPost=post.body;connectionExpires=source.connection.expiresAt.getTime();sourceNotBefore=Math.max(source.connection.updatedAt.getTime(),source.draft.updatedAt.getTime());
  effect=selection.operation==='publish'?post.effect:preparePlatformLinkedInSchedule(source.draft,source.connection,version,now,new Date(selection.scheduledFor),effectId,source.imageLineage,selection.imageUploadActionId).effect;
 }
 if(effect.target.draftId!==selection.draftId||effect.target.connectionId!==selection.connectionId||!isPostingEnabled()||currentLinkedInVersion()!==version||Date.parse(selection.expiresAt)<=now||Date.parse(selection.expiresAt)>connectionExpires)fail();
 const sourceDigest=sha256ContentHash({kind:'platform_growth_source_v1',effect});
 const plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest,expiresAt:selection.expiresAt,effects:[effect]});
 const sourceExpires=selection.operation==='schedule'?Math.min(connectionExpires,Date.parse(selection.scheduledFor)):connectionExpires;
 if(!Number.isSafeInteger(sourceNotBefore)||sourceNotBefore<0||!Number.isSafeInteger(sourceExpires)||sourceNotBefore>=sourceExpires)fail();
 return Object.freeze({plan,timeWindow:Object.freeze({notBefore:sourceNotBefore,expiresAt:sourceExpires}),preview:Object.freeze({sourceDigest,effectId:effect.id,...(renderedPost?{renderedPost}:{})})});
}
