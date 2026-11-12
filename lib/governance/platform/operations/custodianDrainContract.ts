import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
const revision=z.number().int().nonnegative().max(2147483647);
const custodian=z.object({accountId:z.string().regex(/^\d{12}$/),roleArn:z.string().max(768).regex(/^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_\/-]{1,512}$/)}).strict().refine(v=>v.roleArn.startsWith('arn:aws:iam::'+v.accountId+':role/'));
const base={format:z.literal(1),scope:z.literal('platform'),custodian,issuerProfileDigest:digest,sourceEvidenceDigest:digest,predecessorAdmissionDigest:digest,expectedGeneration:revision,expectedVersion:revision.nullable(),expiresAt:z.string().max(40).datetime()};
export const custodianDrainSelection=z.discriminatedUnion('operation',[
 z.object({...base,operation:z.literal('begin')}).strict(),
 z.object({...base,operation:z.literal('abort'),restoredAdmissionDigest:digest}).strict(),
]).superRefine((v,c)=>{
 if((v.expectedGeneration===0)!==(v.expectedVersion===null))c.addIssue({code:'custom',message:'generation and version must identify the same original barrier'});
 if(v.operation==='abort'&&(v.expectedGeneration===0||v.restoredAdmissionDigest!==v.predecessorAdmissionDigest))c.addIssue({code:'custom',message:'abort must restore only its exact predecessor'});
});
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v)}return v}
/** Immutable control metadata ONLY. The native identity excludes profile/action
 * revisions so a changed profile cannot create an unrelated drain lock. Actual
 * current source, participants and platform approval/claim are separate gates. */
export function compileCustodianDrainPlan(raw:unknown){const selection=custodianDrainSelection.parse(raw),nativeKey=sha256ContentHash({purpose:'platform_custodian_role_v1',custodian:selection.custodian});return freeze({...selection,nativeKey,digest:sha256ContentHash({purpose:'platform_custodian_drain_plan_v1',selection}),authority:'metadata_only' as const,executionAuthorized:false as const})}
export type CustodianDrainPlan=ReturnType<typeof compileCustodianDrainPlan>;
export function readCustodianDrainPlan(raw:unknown):CustodianDrainPlan{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('custodian_drain_plan_unavailable');
 const {nativeKey,digest:hash,authority,executionAuthorized,...selection}=raw as Record<string,unknown>,expected=compileCustodianDrainPlan(selection);
 if(nativeKey!==expected.nativeKey||hash!==expected.digest||authority!=='metadata_only'||executionAuthorized!==false)throw Error('custodian_drain_plan_unavailable');return expected;
}
