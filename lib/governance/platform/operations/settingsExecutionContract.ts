import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
export const settingsExecutionCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('claim'),actionId:platformActionId,expectedVersion:z.literal(1),planDigest:digest}).strict(),
 z.object({operation:z.literal('execute'),actionId:platformActionId,expectedVersion:z.literal(2),planDigest:digest,effectIndex:z.number().int().min(0).max(31)}).strict(),
]);
export const settingsClaimReceipt=z.object({actionId:platformActionId,planDigest:digest,status:z.literal('claimed'),version:z.literal(2),attemptCount:z.literal(1),authority:z.literal('claim_record_only'),executionAuthorized:z.literal(false)}).strict();
export const settingsExecutionReceipt=z.object({actionId:platformActionId,effectIndex:z.number().int().min(0).max(31),settingId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),status:z.literal('provider_confirmed'),deploymentPerformed:z.literal(false)}).strict();
export type SettingsClaimReceipt=z.infer<typeof settingsClaimReceipt>;
export type SettingsExecutionReceipt=z.infer<typeof settingsExecutionReceipt>;
