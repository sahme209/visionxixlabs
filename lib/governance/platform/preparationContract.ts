import {z} from 'zod';
import {platformActionId} from './viewContract';
const identity=z.string().min(1).max(256),common={draftId:identity,connectionId:identity,expiresAt:z.string().datetime()};
export const growthPreparationSelection=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('publish'),...common}).strict(),
 z.object({operation:z.literal('schedule'),...common,scheduledFor:z.string().datetime()}).strict(),
 z.object({operation:z.literal('delete'),...common}).strict(),
]);
export const platformPreparationRequestId=z.string().uuid().transform(v=>v.toLowerCase());
export const platformPreparationCommandSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare_growth'),requestId:platformPreparationRequestId,selection:growthPreparationSelection}).strict(),
 z.object({operation:z.literal('lookup_preparation'),requestId:platformPreparationRequestId}).strict(),
]);
export const platformPreparationReceiptSchema=z.object({requestId:platformPreparationRequestId,actionId:platformActionId,historical:z.boolean(),authority:z.literal('proposal_reference_only')}).strict();
export const platformPreparationLookupSchema=z.discriminatedUnion('found',[
 z.object({requestId:platformPreparationRequestId,found:z.literal(false),authority:z.literal('history_only')}).strict(),
 z.object({requestId:platformPreparationRequestId,found:z.literal(true),actionId:platformActionId,authority:z.literal('history_only')}).strict(),
]);
export type PlatformPreparationReceipt=z.infer<typeof platformPreparationReceiptSchema>;
export type PlatformPreparationLookup=z.infer<typeof platformPreparationLookupSchema>;
