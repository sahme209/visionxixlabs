import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId as actionId} from '../viewContract';
import {platformPreparationRequestId as requestId} from '../preparationContract';
import {custodianDrainSelection} from './custodianDrainSelection';
/** Browser-safe data only; no issuer, database, hashing or credentials. */
export const custodianCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare'),selection:custodianDrainSelection,requestId}).strict(),
 z.object({operation:z.literal('lookup'),requestId}).strict(),
 z.object({operation:z.literal('inspect'),actionId}).strict(),
 z.object({operation:z.literal('preview'),actionId}).strict(),
 z.object({operation:z.literal('review'),actionId,expectedVersion:z.literal(0),planDigest:digest}).strict(),
 z.object({operation:z.literal('executeControl'),actionId,expectedVersion:z.literal(1)}).strict(),
 z.object({operation:z.literal('observeClosure'),actionId}).strict(),
 z.object({operation:z.literal('refreshClosure'),actionId}).strict(),
]);
