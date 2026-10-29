import {botActionTaskBindingSchema} from '../axiom/bot/actionTaskBindingContract';
import {z} from 'zod';

export const CONNECTED_ACTION_KIND='connected_app_action_v1';
const identity=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x20\x7f-\x9f]/.test(v));
const uuid=z.string().uuid(),digest=z.string().regex(/^[a-f0-9]{64}$/);
const plain=(bytes:number)=>z.string().min(1).refine(v=>v.trim().length>0&&new TextEncoder().encode(v).byteLength<=bytes&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(v)&&!Array.from(v).some(c=>{const n=c.codePointAt(0)!;return n>=0xd800&&n<=0xdfff}));
export const connectedActionScopeSchema=z.object({organizationId:identity,actorUserId:identity,sessionId:identity}).strict();
const common={sourceTask:botActionTaskBindingSchema.optional(),intentId:uuid,organizationId:identity,requesterUserId:identity,executorUserId:identity,connectionId:identity,connectionRevision:z.string().datetime(),workspaceId:uuid,targetEvidenceDigest:digest,expiresAt:z.string().datetime()};
const linear={...common,provider:z.literal('linear'),teamId:uuid};
export const connectedActionIntentSchema=z.discriminatedUnion('kind',[
 z.object({...common,provider:z.literal('teams'),kind:z.literal('teams_channel_message'),teamId:uuid,channelId:z.string().regex(/^[A-Za-z0-9@._:-]{1,240}$/),text:plain(4000)}).strict(),
 z.object({...linear,kind:z.literal('linear_issue_create'),title:plain(240).refine(v=>!/[\r\n\u2028\u2029]/.test(v)),description:plain(16000).optional()}).strict(),
 z.object({...linear,kind:z.literal('linear_issue_update'),issueId:uuid,title:plain(240).refine(v=>!/[\r\n\u2028\u2029]/.test(v)),description:plain(16000).optional()}).strict(),
 z.object({...linear,kind:z.literal('linear_issue_close'),issueId:uuid,stateId:uuid,stateType:z.literal('completed')}).strict(),
]);
export type ConnectedActionIntent=z.infer<typeof connectedActionIntentSchema>;
export type ConnectedActionScope=z.infer<typeof connectedActionScopeSchema>;
export const connectedActionReceiptSchema=z.discriminatedUnion('provider',[
 z.object({provider:z.literal('teams'),teamId:uuid,channelId:z.string().regex(/^[A-Za-z0-9@._:-]{1,240}$/),messageId:z.string().regex(/^[0-9]{1,24}$/),url:z.string().url().max(2048)}).strict(),
 z.object({provider:z.literal('linear'),teamId:uuid,issueId:uuid,identifier:z.string().regex(/^[A-Z][A-Z0-9_-]{0,39}-[1-9][0-9]{0,19}$/),url:z.string().url().max(2048)}).strict(),
]);
export type ConnectedActionReceipt=z.infer<typeof connectedActionReceiptSchema>;
export const connectedActionResultSchema=z.discriminatedUnion('state',[
 z.object({state:z.literal('confirmed'),receipt:connectedActionReceiptSchema}).strict(),
 z.object({state:z.literal('unknown')}).strict(),z.object({state:z.literal('refused')}).strict(),
]);
export type ConnectedActionResult=z.infer<typeof connectedActionResultSchema>;
export const connectedActionApprovalSchema=z.object({approverUserId:identity,approverSessionId:identity,intentDigest:digest,approvedAt:z.string().datetime(),expiresAt:z.string().datetime()}).strict();
export const connectedActionDtoSchema=z.object({id:z.string().regex(/^connected_action_[a-f0-9]{64}$/),intent:connectedActionIntentSchema,intentDigest:digest,state:z.enum(['requested','approved','dispatching','confirmed','unknown','refused','cancelled']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),receipt:connectedActionReceiptSchema.optional(),approval:connectedActionApprovalSchema.optional(),leaseExpiresAt:z.string().datetime().nullable()}).strict();
export type ConnectedActionDto=z.infer<typeof connectedActionDtoSchema>;

export function hasConnectedActionScope(provider:'teams'|'linear',scopes:readonly string[],required:string){return scopes.some(scope=>provider==='teams'?(scope.toLowerCase()===required.toLowerCase()||scope.toLowerCase()==='https://graph.microsoft.com/'+required.toLowerCase()):scope===required)}
