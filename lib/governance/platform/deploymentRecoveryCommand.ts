import {z} from 'zod';
import {digest} from './contracts';
import {platformActionId as actionId} from './viewContract';
import {platformPreparationRequestId as requestId} from './preparationContract';
/** Browser-safe exact command data, never native evidence or authority. */
export const deploymentRecoverySelection=z.object({nativeKey:digest,requestReceiptId:z.string().regex(/^platform_deployment_receipt_[a-f0-9-]{36}$/),profileDigest:digest,expiresAt:z.string().datetime()}).strict();
export const deploymentRecoveryCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare'),selection:deploymentRecoverySelection,requestId}).strict(),
 z.object({operation:z.literal('lookup'),requestId}).strict(),
 z.object({operation:z.literal('inspect'),actionId}).strict(),
 z.object({operation:z.literal('preview'),actionId}).strict(),
 z.object({operation:z.literal('review'),actionId,expectedVersion:z.literal(0),planDigest:digest}).strict(),
 z.object({operation:z.literal('observe'),actionId,expectedVersion:z.literal(1),planDigest:digest}).strict(),
]);
