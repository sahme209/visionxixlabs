import 'server-only';
import type {ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {botActionTaskReferenceSchema,botActionTaskBindingSchema,type BotActionTaskBinding} from './actionTaskBindingContract';
import {savedBotTaskContentHash} from './savedTaskSchema';
/** Runs inside the action transaction. A version update must wait until its
 * authorization decision completes. Historical result reads need no current-version claim. */
export async function readBotActionTaskBinding(tx:Tx,organizationId:string,requesterUserId:string,raw:unknown):Promise<BotActionTaskBinding>{
 const ref=botActionTaskReferenceSchema.parse(raw);
 const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;createdByUserId:string;status:string;version:number;title:string;instruction:string;context:string;contentHash:string}>>`SELECT "id","organizationId","createdByUserId","status","version","title","instruction","context","contentHash" FROM "BotTaskDraft" WHERE "id"=${ref.taskId} AND "organizationId"=${organizationId} AND "createdByUserId"=${requesterUserId} FOR SHARE`;
 const row=rows[0];if(rows.length!==1||row.id!==ref.taskId||row.organizationId!==organizationId||row.createdByUserId!==requesterUserId||row.status!=='draft'||row.version!==ref.expectedVersion||row.contentHash!==savedBotTaskContentHash({title:row.title,instruction:row.instruction,context:row.context}))throw Error('bot_action_task_changed');
 return botActionTaskBindingSchema.parse({kind:'saved_bot_task_v1',taskId:row.id,taskVersion:row.version,contentHash:row.contentHash});
}
export async function assertBotActionTaskBinding(tx:Tx,organizationId:string,requesterUserId:string,raw:BotActionTaskBinding|undefined){
 if(raw===undefined)return;const bound=botActionTaskBindingSchema.parse(raw),fresh=await readBotActionTaskBinding(tx,organizationId,requesterUserId,{taskId:bound.taskId,expectedVersion:bound.taskVersion});if(fresh.contentHash!==bound.contentHash)throw Error('bot_action_task_changed');
}
