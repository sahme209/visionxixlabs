import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {isPostingEnabled} from '@/lib/growth/linkedin/oauth';
import {preparePlatformLinkedInPost,preparePlatformLinkedInSchedule,currentLinkedInVersion,postingDraftSchema,postingConnectionSchema} from '@/lib/growth/linkedin/platformPostingPlan';
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
 let effect,connectionExpires:number,renderedPost:string|undefined;
 if(selection.operation==='delete'){
  const read=tx.readGrowthDeletionSource??fail(),source=await read.call(tx,selection.draftId,selection.connectionId),prepared=preparePlatformLinkedInDeletion(source,version,now,effectId);
  effect=prepared.effect;
  const parsed=z.object({connection:postingConnectionSchema}).passthrough().parse(source);connectionExpires=parsed.connection.expiresAt.getTime();
 }else{
  const source=z.object({draft:postingDraftSchema,connection:postingConnectionSchema}).strict().parse(await tx.readGrowthPostingSource(selection.draftId,selection.connectionId));
  const post=preparePlatformLinkedInPost(source.draft,source.connection,version,now,effectId);renderedPost=post.body;connectionExpires=source.connection.expiresAt.getTime();
  effect=selection.operation==='publish'?post.effect:preparePlatformLinkedInSchedule(source.draft,source.connection,version,now,new Date(selection.scheduledFor),effectId).effect;
 }
 if(effect.target.draftId!==selection.draftId||effect.target.connectionId!==selection.connectionId||!isPostingEnabled()||currentLinkedInVersion()!==version||Date.parse(selection.expiresAt)<=now||Date.parse(selection.expiresAt)>connectionExpires)fail();
 const sourceDigest=sha256ContentHash({kind:'platform_growth_source_v1',effect});
 const plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest,expiresAt:selection.expiresAt,effects:[effect]});
 return Object.freeze({plan,preview:Object.freeze({sourceDigest,effectId:effect.id,...(renderedPost?{renderedPost}:{})})});
}
