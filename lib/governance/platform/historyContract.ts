import {z} from 'zod';
import {platformActionId} from './viewContract';
import {digest} from './contracts';
import {readPlatformAction} from './kernel';
export const platformHistoryCursor=z.object({createdAt:z.string().datetime(),actionId:platformActionId}).strict();
export type PlatformHistoryCursor=z.infer<typeof platformHistoryCursor>;
const entry=z.object({actionId:platformActionId,createdAt:z.string().datetime(),status:z.enum(['proposed','approved','claimed','confirmed','refused','unknown']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),requesterUserId:z.string().min(1).max(256),reviewerUserId:z.string().min(1).max(256).nullable(),planDigest:digest,expiresAt:z.string().datetime(),effectKinds:z.array(z.string().min(1).max(100)).min(1).max(32)}).strict();
export const platformHistoryPage=z.object({entries:z.array(entry).max(20),nextCursor:platformHistoryCursor.nullable(),authority:z.literal('history_only'),sourceValidation:z.literal('not_checked')}).strict();
export type PlatformHistoryPage=z.infer<typeof platformHistoryPage>;
/** SQL rows are checked, never returned. Session identifiers and raw state stay private. */
export function projectPlatformHistory(rows:unknown,cursor:PlatformHistoryCursor|null){
 const parsed=z.array(z.object({id:platformActionId,createdAt:z.date(),stateJson:z.unknown(),planDigest:digest,version:z.number().int()}).strict()).max(21).parse(rows);
 let previous=cursor;
 const entries=parsed.map(row=>{
  const createdAt=row.createdAt.toISOString(),state=readPlatformAction(row.stateJson);
  if(state.plan.digest!==row.planDigest||state.version!==row.version||previous&&(createdAt>previous.createdAt||createdAt===previous.createdAt&&row.id>=previous.actionId))throw Error('platform_history_unavailable');
  previous={createdAt,actionId:row.id};
  return {actionId:row.id,createdAt,status:state.status,version:state.version,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer?.userId??null,planDigest:state.plan.digest,expiresAt:new Date(state.plan.expiresAt).toISOString(),effectKinds:state.plan.effects.map(e=>e.kind)};
 });
 const visible=entries.slice(0,20),last=visible.at(-1);
 return platformHistoryPage.parse({entries:visible,nextCursor:entries.length===21&&last?{createdAt:last.createdAt,actionId:last.actionId}:null,authority:'history_only',sourceValidation:'not_checked'});
}
