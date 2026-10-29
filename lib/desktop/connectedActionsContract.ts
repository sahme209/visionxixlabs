import {botActionTaskReferenceSchema} from '../axiom/bot/actionTaskBindingContract';
import {z} from 'zod';
import {connectedActionDtoSchema} from '../integrations/connectedActionContract';
import {connectedActionTargetsSchema} from '../integrations/connectedActionDiscoveryContract';
const uuid=z.string().uuid(),id=z.string().regex(/^connected_action_[a-f0-9]{64}$/),version=z.number().int().min(0).max(3);
const text=z.string().min(1).max(16000);
const requestShape=z.discriminatedUnion('action',[
 z.object({action:z.literal('request'),sourceTask:botActionTaskReferenceSchema.optional(),kind:z.enum(['teams_channel_message','linear_issue_create','linear_issue_update','linear_issue_close']),intentId:uuid,teamId:uuid,channelId:z.string().max(240).optional(),issueId:uuid.optional(),stateId:uuid.optional(),title:text.optional(),description:text.optional(),text:text.optional()}).strict(),
 z.object({action:z.enum(['approve','execute','cancel','recover']),id,expectedVersion:version}).strict(),
]);
export const connectedActionsRequestSchema=requestShape.superRefine((v,ctx)=>{if(v.action!=='request')return;const fields=v.kind==='teams_channel_message'?['channelId','text']:v.kind==='linear_issue_create'?['title','description']:v.kind==='linear_issue_update'?['issueId','title','description']:['issueId','stateId'];for(const key of ['channelId','issueId','stateId','title','description','text'] as const)if(v[key]!==undefined&&!fields.includes(key))ctx.addIssue({code:z.ZodIssueCode.custom,path:[key],message:'Field does not belong to this action'});for(const key of fields.filter(k=>k!=='description'))if(!(v as Record<string,unknown>)[key])ctx.addIssue({code:z.ZodIssueCode.custom,path:[key],message:'Required action field'});});
export type ConnectedActionsRequest=z.infer<typeof connectedActionsRequestSchema>;
export const connectedActionViewSchema=connectedActionDtoSchema.extend({canApprove:z.boolean(),canExecute:z.boolean(),canCancel:z.boolean(),canRecover:z.boolean()}).refine(v=>(!v.canApprove||v.state==='requested')&&(!v.canExecute||v.state==='approved')&&(!v.canCancel||['requested','approved'].includes(v.state))&&(!v.canRecover||v.state==='dispatching'));
export const connectedActionsDataSchema=z.object({provider:z.enum(['teams','linear']),enabled:z.boolean(),canRequest:z.boolean(),canApprove:z.boolean(),actions:z.array(connectedActionViewSchema).max(20),targets:connectedActionTargetsSchema.optional(),truncated:z.boolean()}).strict();
export type ConnectedActionsData=z.infer<typeof connectedActionsDataSchema>;
