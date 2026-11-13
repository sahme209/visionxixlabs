import {imagePublicationLineagePublic} from './imagePublicationContract';
import {z} from 'zod';
import {digest} from './contracts';
import {platformActionId,platformInspectionSchema} from './viewContract';
/** Public structural DTOs only. No binary decoding, keys, private bindings,
 * sessions or qualification/execution authority are provided by these parsers. */
export const imageArtifactReference=z.string().regex(/^platform_image_artifact_[a-f0-9-]{36}$/);
const id=z.string().min(1).max(256).refine(v=>v.trim()===v&&!/[\x00-\x1f]/.test(v));
export const imagePublicArtifact=z.object({artifactId:imageArtifactReference,creatorUserId:id,connectionId:id,connectionRevision:id,author:z.string().max(512).regex(/^urn:li:(?:person|organization):[A-Za-z0-9_-]+$/),bytesDigest:digest,byteCount:z.number().int().min(1).max(2097152),mimeType:z.enum(['image/png','image/jpeg']),width:z.number().int().positive().safe(),height:z.number().int().positive().safe(),formatProfileDigest:digest}).strict().refine(v=>Number.isSafeInteger(v.width*v.height));
export const imageCanonicalBase64url=z.string().min(2).max(2796203).regex(/^[A-Za-z0-9_-]+$/).refine(v=>v.length%4!==1&&(v.length%4!==2||/[AQgw]$/.test(v))&&(v.length%4!==3||/[AEIMQUYcgkosw048]$/.test(v)));
const reference=z.string().uuid();
export const imageWorkflowCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('intake'),connectionId:id,mimeType:z.enum(['image/png','image/jpeg']),requestReference:reference,bytesBase64url:imageCanonicalBase64url}).strict(),
 z.object({operation:z.literal('lookup_artifact'),requestReference:reference}).strict(),
 z.object({operation:z.literal('prepare'),artifactId:imageArtifactReference,expiresAt:z.string().datetime(),requestReference:reference}).strict(),
 z.object({operation:z.literal('lookup'),requestReference:reference}).strict(),
 z.object({operation:z.literal('inspect'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('preview'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('preview_post_image'),actionId:platformActionId}).strict(),
 z.object({operation:z.literal('review'),actionId:platformActionId,expectedVersion:z.literal(0),planDigest:digest}).strict(),
 z.object({operation:z.literal('initialize'),actionId:platformActionId,expectedVersion:z.literal(1),planDigest:digest}).strict(),
 z.object({operation:z.literal('put'),actionId:platformActionId,expectedVersion:z.literal(2),planDigest:digest}).strict(),
]);
export type ImageWorkflowCommand=z.infer<typeof imageWorkflowCommand>;
function imagePlan(action:z.infer<typeof platformInspectionSchema>){const [a,b]=action.plan.effects;return action.plan.effects.length===2&&a.kind==='growth.image.initialize'&&b.kind==='growth.image.put'&&'profile' in b.target&&b.target.profile==='private_derived_grant_v1'&&a.target.author===b.target.author&&a.target.connectionId===b.target.connectionId&&a.target.connectionRevision===b.target.connectionRevision&&a.target.bytesDigest===b.target.bytesDigest}
const stamp=z.number().int().nonnegative().safe();
export const imageReadyObservation=z.object({providerImageReference:z.string().max(512).regex(/^urn:li:image:[A-Za-z0-9_-]+$/),author:z.string().max(512).regex(/^urn:li:(?:person|organization):[A-Za-z0-9_-]+$/),observedAt:stamp,profileDigest:digest,restVersion:z.string().regex(/^20[0-9]{2}(?:0[1-9]|1[0-2])$/),mediaReady:z.literal(true)}).strict();
export const imagePutReceipt=z.object({ready:imageReadyObservation.optional(),format:z.literal(1),purpose:z.literal('platform_image_put_result_v1'),actionId:platformActionId,planDigest:digest,grantReference:z.string().regex(/^platform_image_grant_[a-f0-9]{64}$/),outcome:z.enum(['confirmed','refused','unknown']),observedAt:stamp,receiptDigest:digest}).strict();
const uploadHistory=z.object({artifact:imagePublicArtifact,bindingDigest:digest,grant:z.object({providerImageReference:z.string().max(512).regex(/^urn:li:image:[A-Za-z0-9_-]+$/),expiresAt:stamp,claimedAt:stamp.nullable(),result:imagePutReceipt.nullable()}).strict().nullable()}).strict();
export const imageWorkflowHistory=z.object({action:platformInspectionSchema,upload:uploadHistory.optional(),authority:z.literal('image_history_only'),sourceValidation:z.literal('not_checked'),executionAuthorized:z.literal(false)}).strict().superRefine((v,c)=>{
 const bad=()=>c.addIssue({code:'custom',message:'Inconsistent image history'});if(!imagePlan(v.action))return bad();if(!v.upload)return;
 const a=v.upload.artifact,[init,put]=v.action.plan.effects;if(init.kind!=='growth.image.initialize'||put.kind!=='growth.image.put'||!('artifactId' in put.target))return bad();
 if(a.artifactId!==put.target.artifactId||a.creatorUserId!==v.action.requesterUserId||a.author!==init.target.author||a.bytesDigest!==init.target.bytesDigest||a.connectionId!==init.target.connectionId||a.connectionRevision!==init.target.connectionRevision)return bad();
 const g=v.upload.grant;if(!g)return;if(v.action.effects[0]?.status!=='confirmed')return bad();
 if(g.claimedAt!==null&&(g.claimedAt>=g.expiresAt||g.claimedAt>=Date.parse(v.action.plan.expiresAt)||v.action.effects[1]?.status==='not_started'))return bad();
 const r=g.result;if(!r)return;
 if(g.claimedAt===null||r.observedAt<g.claimedAt||r.actionId!==v.action.actionId||r.planDigest!==v.action.plan.digest||r.grantReference!==put.target.grantReference||r.outcome!==v.action.effects[1]?.status||r.outcome!==v.action.status)return bad();
 if(r.ready&&(r.outcome!=='confirmed'||r.ready.providerImageReference!==g.providerImageReference||r.ready.author!==a.author||r.ready.profileDigest!==put.target.destinationProfileDigest||r.ready.observedAt<g.claimedAt||r.ready.observedAt>r.observedAt||r.ready.observedAt>=g.expiresAt||r.ready.observedAt>=Date.parse(v.action.plan.expiresAt)))bad();
});
export const imageWorkflowPreview=z.object({action:platformInspectionSchema,artifact:imagePublicArtifact,bindingDigest:digest,bytesBase64url:imageCanonicalBase64url,authority:z.literal('review_preview_only'),executionAuthorized:z.literal(false)}).strict().superRefine((v,c)=>{
 const [a,b]=v.action.plan.effects,artifact=v.artifact,bad=()=>c.addIssue({code:'custom',message:'Inconsistent image review preview'});
 if(!imagePlan(v.action)||v.action.expired||!['proposed','approved'].includes(v.action.status))return bad();
 if(a.kind!=='growth.image.initialize'||b.kind!=='growth.image.put'||!('artifactId' in b.target))return bad();
 if(b.target.artifactId!==artifact.artifactId||a.target.author!==artifact.author||a.target.bytesDigest!==artifact.bytesDigest||a.target.connectionId!==artifact.connectionId||a.target.connectionRevision!==artifact.connectionRevision||v.action.requesterUserId!==artifact.creatorUserId||Math.floor(v.bytesBase64url.length*6/8)!==artifact.byteCount)bad();
});
export const imageArtifactIntakeResult=z.object({requestReference:reference,artifact:imagePublicArtifact,historical:z.boolean(),authority:z.literal('artifact_metadata_only')}).strict();
export const imageArtifactLookupResult=z.discriminatedUnion('found',[
 z.object({found:z.literal(true),requestReference:reference,artifact:imagePublicArtifact,authority:z.literal('artifact_metadata_only')}).strict(),
 z.object({found:z.literal(false),requestReference:reference,authority:z.literal('artifact_metadata_only')}).strict(),
]);
export const imagePreparedResult=z.object({actionId:platformActionId,historical:z.boolean(),authority:z.literal('proposal_reference_only')}).strict();
export const imageActionLookupResult=z.discriminatedUnion('found',[
 z.object({found:z.literal(true),actionId:platformActionId,authority:z.literal('history_only')}).strict(),
 z.object({found:z.literal(false),authority:z.literal('history_only')}).strict(),
]);

/** New post/schedule authority; the original upload is historical provenance. */
export const postImageWorkflowPreview=z.object({action:platformInspectionSchema,artifact:imagePublicArtifact,lineage:imagePublicationLineagePublic,renderedPost:z.string().max(65536),bytesBase64url:imageCanonicalBase64url,authority:z.literal('post_image_review_preview_only'),executionAuthorized:z.literal(false)}).strict().superRefine((v,c)=>{
 const bad=()=>c.addIssue({code:'custom',message:'Inconsistent post image preview'}),e=v.action.plan.effects[0],a=v.artifact,l=v.lineage;
 if(v.action.expired||!['proposed','approved'].includes(v.action.status)||v.action.plan.effects.length!==1||(e.kind!=='growth.post.publish'&&e.kind!=='growth.schedule.change'))return bad();
 if(e.target.imageUploadActionId!==l.uploadActionId||e.target.imageLineageDigest!==l.lineageDigest||e.target.connectionId!==l.connectionId||e.target.author!==l.author||a.artifactId!==l.artifactId||a.bytesDigest!==l.bytesDigest||a.connectionId!==l.connectionId||a.author!==l.author||Math.floor(v.bytesBase64url.length*6/8)!==a.byteCount)return bad();
 try{const post=JSON.parse(v.renderedPost);if(post.author!==l.author||post.content?.media?.id!==l.providerImageReference)bad()}catch{bad()}
});
