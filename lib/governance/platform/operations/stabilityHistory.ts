import {z} from 'zod';
import {digest,platformPrincipalSchema} from '../contracts';
import {readPlatformAction} from '../kernel';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readOperationalEcsResult} from './ecsExecution';
import {readOperationalTargetReceipt} from './reservationContract';
import {operationalEvidenceId} from './contracts';
const eventSchema=z.object({operationalObserverUserId:platformPrincipalSchema.shape.userId,operationalStabilityReceiptId:operationalEvidenceId,operationalCommandReceiptDigest:digest,planDigest:digest,stateDigest:digest,status:z.literal('confirmed'),attemptCount:z.literal(1)}).strict();
/** Historical lineage, not fresh native qualification, health or permission. */
export function readOperationalStabilityHistory(actionId:string,rawParent:unknown,rawResult:unknown,rawEvent:unknown,rawNative:unknown){
 const parent=readPlatformAction(rawParent),result=readOperationalEcsResult(rawResult),event=eventSchema.parse(rawEvent),native=readOperationalTargetReceipt(rawNative);
 const fail=():never=>{throw Error('operational_stability_history_unavailable')};
 if(parent.status!=='confirmed'||parent.attemptCount!==1||parent.plan.effects.length!==1||parent.plan.effects[0].kind!=='deployment.ecs'||event.planDigest!==parent.plan.digest||event.stateDigest!==sha256ContentHash(parent)||event.operationalCommandReceiptDigest!==result.receiptDigest||event.operationalStabilityReceiptId!==native.receiptId)return fail();
 if(result.kind!=='accepted'||result.actionId!==actionId||result.manifestDigest!==parent.plan.sourceDigest||native.kind!=='stable'||native.actionId!==actionId||native.manifestDigest!==result.manifestDigest||native.nativeKey!==result.nativeKey||native.generation!==result.generation||!('kind' in native.detail)||native.detail.kind!=='stable'||native.detail.deploymentId!==result.deploymentId)return fail();
 const observedAt=Date.parse(native.detail.observedAt);if(observedAt<result.observedAt||observedAt>parent.updatedAt)return fail();
 return Object.freeze({receiptId:native.receiptId,receiptDigest:native.receiptDigest,commandReceiptDigest:result.receiptDigest,observerUserId:event.operationalObserverUserId,deploymentId:result.deploymentId!,observedAt:native.detail.observedAt,recordedAt:parent.updatedAt,authority:'historical_stability_only' as const,currentHealthChecked:false as const,executionAuthorized:false as const});
}
