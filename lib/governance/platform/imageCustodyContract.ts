import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {platformPrincipalSchema,digest,platformPlanSchema} from './contracts';
import {platformActionId} from './viewContract';
import {compilePlatformPlan} from './kernel';
export const IMAGE_ARTIFACT_MAX_BYTES=2*1024*1024;
const id=z.string().min(1).max(256).refine(v=>v.trim()===v&&!/[\x00-\x1f]/.test(v));
/** Local metadata grammar only, not a verified provider/decoder profile. */
const author=z.string().max(512).regex(/^urn:li:(?:person|organization):[A-Za-z0-9_-]+$/);
export const imageArtifactMetadata=z.object({artifactId:z.string().regex(/^platform_image_artifact_[a-f0-9-]{36}$/),creatorUserId:id,connectionId:id,connectionRevision:id,author,bytesDigest:digest,byteCount:z.number().int().min(1).max(IMAGE_ARTIFACT_MAX_BYTES),mimeType:z.enum(['image/png','image/jpeg']),width:z.number().int().positive().safe(),height:z.number().int().positive().safe(),formatProfileDigest:digest}).strict().refine(v=>Number.isSafeInteger(v.width*v.height));
export type ImageArtifactMetadata=z.infer<typeof imageArtifactMetadata>;
const profile=z.object({profileId:id,profileDigest:digest,destinationOrigin:z.string().max(2048).refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&u.origin===v}catch{return false}})}).strict();
const input=z.object({artifact:imageArtifactMetadata,requester:platformPrincipalSchema,actionId:platformActionId,expiresAt:z.string().datetime(),profile}).strict();
const fail=():never=>{throw Error('platform_image_custody_unavailable')};
function freeze<T>(v:T):Readonly<T>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
export function compileImageArtifactMetadata(raw:unknown){return freeze(imageArtifactMetadata.parse(raw))}
/** Clone-resistant external workflow identity. Deliberately excludes artifact,
 * action, creator, connection/revision, session and all profile versions. */
export function imageInitializerKey(raw:unknown){const a=imageArtifactMetadata.parse(raw);return hash({purpose:'linkedin_image_initialize_v1',author:a.author,bytesDigest:a.bytesDigest})}
function compile(raw:unknown){const v=input.parse(raw),a=v.artifact;if(a.creatorUserId!==v.requester.userId)return fail();const metadata={purpose:'platform_image_grant_reference_v1',actionId:v.actionId,initializeIndex:0,putIndex:1,artifactId:a.artifactId,bytesDigest:a.bytesDigest,connectionId:a.connectionId,connectionRevision:a.connectionRevision,author:a.author,destinationProfileId:v.profile.profileId,destinationProfileDigest:v.profile.profileDigest,destinationOrigin:v.profile.destinationOrigin};const uploadGrantDigest=hash(metadata),grantReference='platform_image_grant_'+uploadGrantDigest,social={connectionId:a.connectionId,connectionRevision:a.connectionRevision,author:a.author,bytesDigest:a.bytesDigest};const sourceDigest=hash({purpose:'platform_image_upload_source_v1',...v,grantMetadata:metadata}),plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest,expiresAt:v.expiresAt,effects:[{id:'platform-image-initialize',kind:'growth.image.initialize',target:social},{id:'platform-image-put',kind:'growth.image.put',target:{...social,uploadGrantDigest,grantReference,artifactId:a.artifactId,profile:'private_derived_grant_v1',destinationProfileId:v.profile.profileId,destinationProfileDigest:v.profile.profileDigest,destinationOrigin:v.profile.destinationOrigin}}]});return {...v,format:1 as const,purpose:'platform_image_upload_binding_v1' as const,sourceDigest,grantReference,uploadGrantDigest,initializeIndex:0 as const,putIndex:1 as const,plan}}
const saved=input.extend({format:z.literal(1),purpose:z.literal('platform_image_upload_binding_v1'),sourceDigest:digest,grantReference:z.string().regex(/^platform_image_grant_[a-f0-9]{64}$/),uploadGrantDigest:digest,initializeIndex:z.literal(0),putIndex:z.literal(1),plan:platformPlanSchema.extend({digest}).strict(),bindingDigest:digest}).strict();
export type ImageUploadBinding=z.infer<typeof saved>;
/** Pure plan proposal. A structural private profile is never its qualification;
 * real intake, review rendering and native sends must still refuse without it. */
export function prepareImageUploadBinding(raw:unknown,now:number):Readonly<ImageUploadBinding>{z.number().int().nonnegative().safe().parse(now);const b=compile(raw);if(Date.parse(b.expiresAt)<=now)return fail();return freeze({...b,bindingDigest:hash(b)})}
export function readImageUploadBinding(raw:unknown):Readonly<ImageUploadBinding>{const b=saved.parse(raw),{format,purpose,sourceDigest,grantReference,uploadGrantDigest,initializeIndex,putIndex,plan,bindingDigest,...selection}=b;const actual=compile(selection);if(hash(actual)!==bindingDigest||hash({...actual,bindingDigest})!==hash(b))return fail();return freeze(b)}
