import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
import {ecsManifestMetadata} from './ecsReviewContract';
import {operationalWorkloadReference,operationalEvidenceId} from './contracts';
import {operationalCredentialState} from './credentialContract';
import {operationalEcsResultSchema} from './ecsResultContract';
const clock=z.number().int().nonnegative().safe(),person=z.string().min(1).max(256);
export const ecsStabilityHistory=z.object({receiptId:operationalEvidenceId,receiptDigest:digest,commandReceiptDigest:digest,observerUserId:person,deploymentId:z.string().regex(/^ecs-svc\/[0-9]{1,32}$/),observedAt:z.string().datetime(),recordedAt:clock,authority:z.literal('historical_stability_only'),currentHealthChecked:z.literal(false),executionAuthorized:z.literal(false)}).strict();
/** Recorded facts only. No current source, credential value or execution proof. */
export const ecsHistory=z.object({
 stability:ecsStabilityHistory.nullable().optional(),actionId:platformActionId,manifest:ecsManifestMetadata,status:z.enum(['delegated','claimed']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),requesterUserId:person,reviewerUserId:person,
 executionPrincipal:z.object({kind:z.literal('workload'),workload:operationalWorkloadReference,profileDigest:digest,expiresAt:clock}).strict().nullable(),
 credential:operationalCredentialState,targetReservation:z.object({nativeKey:digest,generation:z.number().int().positive().safe()}).strict().nullable(),expired:z.boolean(),authority:z.literal('delegation_history_only'),sourceValidation:z.literal('not_checked'),executionAuthorized:z.literal(false),providerExecution:z.literal(false),
 parentStatus:z.enum(['approved','claimed','confirmed','unknown']),parentVersion:z.number().int().min(1).max(3),effectStatus:z.enum(['claimed','confirmed','unknown']).nullable(),result:operationalEcsResultSchema.nullable(),
}).strict().refine(v=>{
 if(v.requesterUserId===v.reviewerUserId)return false;
 if(v.stability&&(v.parentStatus!=='confirmed'||!v.result||v.result.kind!=='accepted'||v.stability.commandReceiptDigest!==v.result.receiptDigest||v.stability.deploymentId!==v.result.deploymentId||Date.parse(v.stability.observedAt)<v.result.observedAt||Date.parse(v.stability.observedAt)>v.stability.recordedAt))return false;
 if(v.status==='delegated')return v.version===0&&v.attemptCount===0&&v.executionPrincipal===null&&v.credential.status==='not_requested'&&v.targetReservation===null&&v.parentStatus==='approved'&&v.parentVersion===1&&v.effectStatus===null&&v.result===null;
 if(v.attemptCount!==1||!v.executionPrincipal||!v.targetReservation||JSON.stringify(v.executionPrincipal.workload)!==JSON.stringify(v.manifest.workload))return false;
 if(v.version!==(v.credential.status==='not_requested'?1:v.credential.status==='pending'?2:3))return false;
 if(v.parentStatus==='approved'||v.parentVersion!==(v.parentStatus==='claimed'?2:3))return false;
 if(v.effectStatus==='confirmed'||v.effectStatus==='unknown'){
  const r=v.result,ref=v.targetReservation,c=v.credential;
  return !!r&&(r.kind==='accepted'?r.deploymentId!==null&&r.requestId!==null:r.deploymentId===null&&r.requestId===null)&&c.status==='issued'&&r.actionId===v.actionId&&r.manifestDigest===v.manifest.digest&&r.nativeKey===ref.nativeKey&&r.generation===ref.generation&&r.leaseRef===c.leaseRef&&r.kind===(v.effectStatus==='confirmed'?'accepted':'unknown');
 }
 return v.result===null;
});
export type EcsHistory=z.infer<typeof ecsHistory>;
