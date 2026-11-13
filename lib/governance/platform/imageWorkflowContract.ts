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
 z.object({operation:z.literal('review'),actionId:platformActionId,expectedVersion:z.literal(0),planDigest:digest}).strict(),
]);
export type ImageWorkflowCommand=z.infer<typeof imageWorkflowCommand>;
function imagePlan(action:z.infer<typeof platformInspectionSchema>){const [a,b]=action.plan.effects;return action.plan.effects.length===2&&a.kind==='growth.image.initialize'&&b.kind==='growth.image.put'&&'profile' in b.target&&b.target.profile==='private_derived_grant_v1'&&a.target.author===b.target.author&&a.target.connectionId===b.target.connectionId&&a.target.connectionRevision===b.target.connectionRevision&&a.target.bytesDigest===b.target.bytesDigest}
export const imageWorkflowHistory=z.object({action:platformInspectionSchema,authority:z.literal('image_history_only'),sourceValidation:z.literal('not_checked'),executionAuthorized:z.literal(false)}).strict().refine(v=>imagePlan(v.action));
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
