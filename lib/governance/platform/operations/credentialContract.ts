import {z} from 'zod';
const clock=z.number().int().nonnegative().safe();
export const credentialOutcome=z.discriminatedUnion('status',[
 z.object({status:z.literal('issued'),leaseRef:z.string().regex(/^platform_credential_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),expiresAt:clock}).strict(),
 z.object({status:z.literal('unknown')}).strict(),
]);
export const operationalCredentialState=z.discriminatedUnion('status',[
 z.object({status:z.literal('not_requested')}).strict(),
 z.object({status:z.literal('pending'),requestedAt:clock}).strict(),
 z.object({status:z.literal('issued'),requestedAt:clock,observedAt:clock,leaseRef:z.string().regex(/^platform_credential_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),expiresAt:clock}).strict(),
 z.object({status:z.literal('unknown'),requestedAt:clock,observedAt:clock}).strict(),
]);

export type OperationalCredentialState=z.infer<typeof operationalCredentialState>;
