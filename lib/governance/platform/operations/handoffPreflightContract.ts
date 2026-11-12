import {z} from 'zod';
import {platformActionId} from '../viewContract';
import {digest} from '../contracts';
import {operationalWorkloadReference} from './contracts';
/** Nonsecret snapshot only. Cannot be submitted as an execution proof. */
const metadata=z.object({actionId:platformActionId,manifestDigest:digest,issuerProfileDigest:digest,workload:operationalWorkloadReference.safeExtend({environment:operationalWorkloadReference.shape.environment.unwrap(),protectionRevision:digest}),observedAt:z.number().int().nonnegative().safe(),expiresAt:z.string().max(40).datetime(),executionAuthorized:z.literal(false)}).strict();
export const handoffPreflightMetadata=metadata.extend({authority:z.literal('handoff_preflight_only')}).strict().refine(v=>v.observedAt<Date.parse(v.expiresAt));
export const handoffSourceMetadata=metadata.extend({authority:z.literal('handoff_source_only')}).strict().refine(v=>v.observedAt<Date.parse(v.expiresAt));
