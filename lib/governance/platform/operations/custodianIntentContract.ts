import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
const revision=z.number().int().nonnegative().max(2147483647);
export const custodianIntentSelection=z.object({format:z.literal(1),scope:z.literal('platform'),actionId:z.string().regex(/^platform_action_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),manifestDigest:digest,nativeKey:digest,issuerProfileDigest:digest,admissionDigest:digest,generation:revision.min(1),barrierVersion:revision,stage:z.enum(['source.acquire','role.acquire','ecs.send']),createdAt:z.number().int().nonnegative().safe()}).strict().refine(v=>v.barrierVersion===2*(v.generation-1)+1);
export type CustodianIntentStage=z.infer<typeof custodianIntentSelection>['stage'];
/** An intent is a permanent conservative liability, not proof of a provider send
 * or approval. Its identity excludes generations/profiles: an original action
 * cannot get a second attempt by selecting a different issuer coordinate. */
export function compileCustodianIntent(raw:unknown){const selected=custodianIntentSelection.parse(raw);return Object.freeze({...selected,id:'platform_intent_'+sha256ContentHash({purpose:'platform_custodian_intent_v1',actionId:selected.actionId,stage:selected.stage}),digest:sha256ContentHash({purpose:'platform_custodian_intent_binding_v1',selected}),status:'native_ready' as const,hold:true as const,executionAuthorized:false as const,closureObserved:false as const})}
export type CustodianIntent=ReturnType<typeof compileCustodianIntent>;
export function readCustodianIntent(raw:unknown):CustodianIntent{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('platform_custodian_intent_unavailable');
 const {id,digest:hash,status,hold,executionAuthorized,closureObserved,...selected}=raw as Record<string,unknown>,expected=compileCustodianIntent(selected);
 if(id!==expected.id||hash!==expected.digest||status!=='native_ready'||hold!==true||executionAuthorized!==false||closureObserved!==false)throw Error('platform_custodian_intent_unavailable');return expected;
}
