import {z} from 'zod';
import {digest} from '../contracts';
const clock=z.number().int().nonnegative().safe();
export const custodianCredentialObservation=z.object({leaseRef:z.string().regex(/^platform_credential_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),profileDigest:digest,expiresAt:clock}).strict();
export const custodianCredentialState=z.discriminatedUnion('status',[
 z.object({status:z.literal('pending'),requestedAt:clock}).strict(),
 z.object({status:z.literal('unknown'),requestedAt:clock,observedAt:clock}).strict(),
 custodianCredentialObservation.extend({status:z.literal('issued'),requestedAt:clock,observedAt:clock}).strict(),
]);
export type CustodianCredentialObservation=z.infer<typeof custodianCredentialObservation>;
