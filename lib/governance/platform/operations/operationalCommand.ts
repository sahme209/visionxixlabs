import {z} from 'zod';
import {digest} from '../contracts';
import {operationalEcsManifest} from './contracts';
import {platformActionId} from '../viewContract';
import {platformPreparationRequestId} from '../preparationContract';
const actionId=platformActionId;
export const operationalCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('preview'),actionId}).strict(),
 z.object({operation:z.literal('review'),actionId,expectedVersion:z.number().int().nonnegative(),planDigest:digest}).strict(),
 z.object({operation:z.literal('prepare'),selection:operationalEcsManifest,requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('lookup'),requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('inspect'),actionId}).strict(),
 z.object({operation:z.literal('observe'),actionId}).strict(),
 z.object({operation:z.literal('delegate'),actionId,expectedVersion:z.number().int().nonnegative(),planDigest:digest}).strict(),
]);
