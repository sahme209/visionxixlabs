import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {operationalManifestSchema,operationalFailureObservation} from './contracts';
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value}
/** Pure metadata compilation. No reference, digest, claimed run or successful
 * structural comparison establishes current qualified source or authority. */
export function compileOperationalManifest(raw:unknown){
 const manifest=operationalManifestSchema.parse(raw);
 return freeze({...manifest,digest:sha256ContentHash({kind:'operational_manifest_v1',manifest}),authority:'metadata_only' as const,executionAuthorized:false as const,...(manifest.kind==='release.manual'?{ownerAuthorization:'external_not_verified' as const}:{})});
}
export type OperationalManifest=ReturnType<typeof compileOperationalManifest>;
/** Structural matching ONLY. Actual execution additionally needs private
 * qualified observation/delegation/current-authority suppliers; never call this
 * on client JSON and treat true as a send or rollback capability. */
export function matchesOperationalRollbackFailure(manifest:OperationalManifest,raw:unknown):boolean{
 if(manifest.kind!=='deployment.ecs'||manifest.operation!=='rollback')return false;
 const result=operationalFailureObservation.safeParse(raw);if(!result.success)return false;
 const observed=result.data,condition=manifest.condition,target=manifest.target;
 return observed.actionId===condition.failedActionId&&observed.receiptId===condition.failureReceiptId&&observed.generation===condition.generation&&observed.failedTaskDefinitionArn===condition.failedTaskDefinitionArn&&observed.accountId===target.accountId&&observed.region===target.region&&observed.clusterArn===target.clusterArn&&observed.serviceArn===target.serviceArn;
}
