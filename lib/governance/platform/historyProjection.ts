import 'server-only';
import {z} from 'zod';
import {platformActionId} from './viewContract';
import {digest} from './contracts';
import {readPlatformAction} from './kernel';
import {platformHistoryPage,historyEntryBefore,type PlatformHistoryCursor} from './historyContract';
/** SQL rows are checked, never returned. Session identifiers and raw state stay private. */
export function projectPlatformHistory(rows:unknown,cursor:PlatformHistoryCursor|null){
 const parsed=z.array(z.object({id:platformActionId,createdAt:z.date(),stateJson:z.unknown(),planDigest:digest,version:z.number().int()}).strict()).max(21).parse(rows);
 let previous=cursor;
 const entries=parsed.map(row=>{
  const createdAt=row.createdAt.toISOString(),state=readPlatformAction(row.stateJson);
  if(state.plan.digest!==row.planDigest||state.version!==row.version||previous&&!historyEntryBefore({createdAt,actionId:row.id},previous))throw Error('platform_history_unavailable');
  previous={createdAt,actionId:row.id};
  return {actionId:row.id,createdAt,status:state.status,version:state.version,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer?.userId??null,planDigest:state.plan.digest,expiresAt:new Date(state.plan.expiresAt).toISOString(),effectKinds:state.plan.effects.map(e=>e.kind)};
 });
 const visible=entries.slice(0,20),last=visible.at(-1);
 return platformHistoryPage.parse({entries:visible,nextCursor:entries.length===21&&last?{createdAt:last.createdAt,actionId:last.actionId}:null,authority:'history_only',sourceValidation:'not_checked'});
}
