import {z} from 'zod';
import {platformActionId} from './viewContract';
import {digest} from './contracts';
export const platformHistoryCursor=z.object({createdAt:z.string().datetime(),actionId:platformActionId}).strict();
export type PlatformHistoryCursor=z.infer<typeof platformHistoryCursor>;
const entry=z.object({actionId:platformActionId,createdAt:z.string().datetime(),status:z.enum(['proposed','approved','claimed','confirmed','refused','unknown']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),requesterUserId:z.string().min(1).max(256),reviewerUserId:z.string().min(1).max(256).nullable(),planDigest:digest,expiresAt:z.string().datetime(),effectKinds:z.array(z.string().min(1).max(100)).min(1).max(32)}).strict();
export const platformHistoryPage=z.object({entries:z.array(entry).max(20),nextCursor:platformHistoryCursor.nullable(),authority:z.literal('history_only'),sourceValidation:z.literal('not_checked')}).strict().superRefine((page,c)=>{
 const fail=()=>c.addIssue({code:'custom',message:'Inconsistent historical page'});
 const seen=new Set<string>();let previous:PlatformHistoryCursor|null=null;
 const versions={proposed:0,approved:1,claimed:2,confirmed:3,refused:3,unknown:3};
 for(const e of page.entries){
  if(seen.has(e.actionId)||previous&&!historyEntryBefore(e,previous))fail();seen.add(e.actionId);previous=e;
  if(e.version!==versions[e.status]||e.attemptCount!==(['proposed','approved'].includes(e.status)?0:1)||e.reviewerUserId===e.requesterUserId||(e.status==='proposed'?e.reviewerUserId!==null:e.reviewerUserId===null))fail();
 }
 if(page.nextCursor&&(page.entries.length!==20||!previous||page.nextCursor.actionId!==previous.actionId||Date.parse(page.nextCursor.createdAt)!==Date.parse(previous.createdAt)))fail();
});
export type PlatformHistoryPage=z.infer<typeof platformHistoryPage>;
export const platformHistoryCommand=z.object({operation:z.literal('list_history'),cursor:platformHistoryCursor.nullable()}).strict();

export function historyEntryBefore(entry:PlatformHistoryCursor,cursor:PlatformHistoryCursor){const a=Date.parse(entry.createdAt),b=Date.parse(cursor.createdAt);return a<b||a===b&&entry.actionId<cursor.actionId}
