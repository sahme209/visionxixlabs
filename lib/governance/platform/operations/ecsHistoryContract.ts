import {z} from 'zod';
import {digest} from '../contracts';
import {platformActionId} from '../viewContract';
import {ecsManifestMetadata} from './ecsReviewContract';
import {operationalWorkloadReference} from './contracts';
import {operationalCredentialState} from './credentialContract';
import {operationalEcsResultSchema} from './ecsResultContract';
const clock=z.number().int().nonnegative().safe(),person=z.string().min(1).max(256);
/** Recorded facts only. No current source, credential value or execution proof. */
export const ecsHistory=z.object({
 actionId:platformActionId,manifest:ecsManifestMetadata,status:z.enum(['delegated','claimed']),version:z.number().int().min(0).max(3),attemptCount:z.number().int().min(0).max(1),requesterUserId:person,reviewerUserId:person,
 executionPrincipal:z.object({kind:z.literal('workload'),workload:operationalWorkloadReference,profileDigest:digest,expiresAt:clock}).strict().nullable(),
 credential:operationalCredentialState,targetReservation:z.object({nativeKey:digest,generation:z.number().int().positive().safe()}).strict().nullable(),expired:z.boolean(),authority:z.literal('delegation_history_only'),sourceValidation:z.literal('not_checked'),executionAuthorized:z.literal(false),providerExecution:z.literal(false),
 parentStatus:z.enum(['approved','claimed','confirmed','unknown']),parentVersion:z.number().int().min(1).max(3),effectStatus:z.enum(['claimed','confirmed','unknown']).nullable(),result:operationalEcsResultSchema.nullable(),
}).strict().refine(v=>{
 if(v.requesterUserId===v.reviewerUserId)return false;
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
