import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
export const operationalEcsResultBody=z.object({format:z.literal(1),purpose:z.literal('operational_ecs_update_result_v1'),actionId:platformActionId,manifestDigest:digest,nativeKey:digest,generation:z.number().int().positive().safe(),leaseRef:z.string().regex(/^platform_credential_[a-f0-9-]{36}$/),kind:z.enum(['accepted','unknown']),deploymentId:z.string().regex(/^ecs-svc\/[0-9]{1,32}$/).nullable(),requestId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).nullable(),observedAt:z.number().int().nonnegative().safe(),stable:z.literal(false),rollbackAuthorized:z.literal(false)}).strict();
export const operationalEcsResultSchema=operationalEcsResultBody.extend({receiptDigest:digest}).strict();
