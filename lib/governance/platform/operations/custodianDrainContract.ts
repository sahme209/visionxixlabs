import {compilePlatformPlan} from '../kernel';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {custodianDrainSelection} from './custodianDrainSelection';
export {custodianDrainSelection} from './custodianDrainSelection';
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

/** The existing platform action/review/claim ledger owns control decisions. This
 * conversion supplies only the exact immutable effect, never an approval. */
export function compileCustodianDrainPlatformPlan(raw:unknown){const control=readCustodianDrainPlan(raw);return compilePlatformPlan({format:1,scope:'platform',sourceDigest:control.digest,expiresAt:control.expiresAt,effects:[{id:'custodian-drain',kind:'custodian.drain',target:{accountId:control.custodian.accountId,roleArn:control.custodian.roleArn,nativeKey:control.nativeKey,issuerProfileDigest:control.issuerProfileDigest,controlDigest:control.digest,operation:control.operation}}]})}
