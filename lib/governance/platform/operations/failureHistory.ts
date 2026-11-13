import {readPlatformAction} from '../kernel';
import {readOperationalEcsResult} from './ecsExecution';
import {readOperationalTargetReceipt} from './reservationContract';
/** Original immutable receipt lineage only. No fresh health qualification,
 * parent reconciliation, credential closure or rollback permission. */
export function readOperationalFailureHistory(actionId:string,rawParent:unknown,rawResult:unknown,rawNative:unknown,now:number){
 const parent=readPlatformAction(rawParent),result=readOperationalEcsResult(rawResult),native=readOperationalTargetReceipt(rawNative),effect=parent.plan.effects[0];
 const fail=():never=>{throw Error('operational_failure_history_unavailable')};
 if(!Number.isSafeInteger(now)||now<parent.updatedAt||parent.status!=='claimed'||parent.attemptCount!==1||parent.plan.effects.length!==1||effect.kind!=='deployment.ecs'||result.kind!=='accepted'||result.actionId!==actionId||result.manifestDigest!==parent.plan.sourceDigest||native.kind!=='terminal_failure'||native.actionId!==actionId||native.manifestDigest!==result.manifestDigest||native.nativeKey!==result.nativeKey||native.generation!==result.generation||!('kind' in native.detail)||native.detail.kind!=='terminal_failure'||native.detail.deploymentId!==result.deploymentId)return fail();
 const target=native.detail.target;if(target.accountId!==effect.target.accountId||target.region!==effect.target.region||target.clusterArn!==effect.target.cluster||target.serviceArn!==effect.target.service||target.taskDefinitionArn!==effect.target.taskDefinitionArn)return fail();
 const observedAt=Date.parse(native.detail.observedAt);if(observedAt<result.observedAt||observedAt>now)return fail();
 return Object.freeze({receiptId:native.receiptId,receiptDigest:native.receiptDigest,commandReceiptDigest:result.receiptDigest,deploymentId:result.deploymentId!,generation:result.generation,kind:'terminal_failure' as const,observedAt:native.detail.observedAt,authority:'historical_failure_only' as const,sourceValidation:'not_checked' as const,currentHealthChecked:false as const,rollbackAuthorized:false as const,executionAuthorized:false as const});
}
