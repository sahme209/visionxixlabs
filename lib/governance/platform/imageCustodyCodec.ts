import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {encryptScopedWithKey,decryptScopedWithKey} from '@/lib/security/credentialVaultCrypto';
import {IMAGE_ARTIFACT_MAX_BYTES,imageArtifactMetadata,readImageUploadBinding} from './imageCustodyContract';
import {platformPrincipalSchema} from './contracts';
const fail=():never=>{throw Error('platform_image_custody_unavailable')},stamp=z.number().int().nonnegative().safe();
const native=z.object({providerImageReference:z.string().max(512).regex(/^urn:li:image:[A-Za-z0-9_-]+$/),issuedAt:stamp,expiresAt:stamp}).strict();
const grantContext=z.object({format:z.literal(1),purpose:z.literal('platform_image_upload_grant_context_v1'),binding:z.unknown(),native}).strict();
function keyCopy(raw:unknown){if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return fail();return Buffer.from(raw)}
function binary(raw:unknown,a:z.infer<typeof imageArtifactMetadata>){if(!(raw instanceof Uint8Array)||raw.byteLength!==a.byteCount||raw.byteLength<1||raw.byteLength>IMAGE_ARTIFACT_MAX_BYTES)return fail();const bytes=Buffer.from(raw);if(createHash('sha256').update(bytes).digest('hex')!==a.bytesDigest){bytes.fill(0);return fail()}return bytes}
function decode(raw:unknown){if(typeof raw!=='string'||raw.length<1||raw.length>Math.ceil(IMAGE_ARTIFACT_MAX_BYTES*4/3)||!/^[A-Za-z0-9_-]+$/.test(raw))return fail();const b=Buffer.from(raw,'base64url');if(b.toString('base64url')!==raw){b.fill(0);return fail()}return b}
function cipher(raw:unknown,maxPlain:number){if(typeof raw!=='string'||raw.length>4*Math.ceil((maxPlain+28)/3)+3||!/^v2\.[A-Za-z0-9_-]+$/.test(raw))return fail();const value=raw.slice(3),b=Buffer.from(value,'base64url');if(b.length<28||b.toString('base64url')!==value)return fail();return raw}
/** Private custody primitive only: exact byte verification is NOT actual image
 * decoding. No intake/render path may treat these parsers as format proof. */
export function sealImageArtifact(rawKey:unknown,rawArtifact:unknown,rawBytes:unknown){let key:Buffer|undefined,bytes:Buffer|undefined;try{const a=imageArtifactMetadata.parse(rawArtifact);bytes=binary(rawBytes,a);key=keyCopy(rawKey);return encryptScopedWithKey(key,bytes.toString('base64url'),'axiom.platform.image.artifact/1:'+hash(a))}catch{return fail()}finally{key?.fill(0);bytes?.fill(0)}}
export function openImageArtifact(rawKey:unknown,rawArtifact:unknown,rawCipher:unknown){let key:Buffer|undefined,decoded:Buffer|undefined;try{const a=imageArtifactMetadata.parse(rawArtifact),encoded=cipher(rawCipher,Math.ceil(IMAGE_ARTIFACT_MAX_BYTES*4/3));key=keyCopy(rawKey);decoded=decode(decryptScopedWithKey(key,encoded,'axiom.platform.image.artifact/1:'+hash(a)));return binary(decoded,a)}catch{return fail()}finally{key?.fill(0);decoded?.fill(0)}}
export function imageUploadGrantContext(rawBinding:unknown,rawNative:unknown){const binding=readImageUploadBinding(rawBinding),value=native.parse(rawNative);if(value.expiresAt<=value.issuedAt)return fail();return Object.freeze({format:1 as const,purpose:'platform_image_upload_grant_context_v1' as const,binding,native:Object.freeze(value)})}
function context(raw:unknown){const c=grantContext.parse(raw),v=imageUploadGrantContext(c.binding,c.native);if(hash(v)!==hash(c))return fail();return v}
function address(raw:unknown,c:ReturnType<typeof context>){if(typeof raw!=='string'||raw.includes('\0')||Buffer.byteLength(raw,'utf8')>8192||Buffer.from(raw,'utf8').toString('utf8')!==raw)return fail();const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.origin!==c.binding.profile.destinationOrigin)return fail();return raw}
/** Complete address remains private. Same-origin parsing here is NOT an upload
 * destination/path/response qualification and cannot authorize any transport. */
export function sealImageUploadGrant(rawKey:unknown,rawContext:unknown,rawAddress:unknown){let key:Buffer|undefined;try{const c=context(rawContext),plain=address(rawAddress,c);key=keyCopy(rawKey);return encryptScopedWithKey(key,plain,'axiom.platform.image.upload-grant/1:'+hash(c))}catch{return fail()}finally{key?.fill(0)}}
export function openImageUploadGrant(rawKey:unknown,rawContext:unknown,rawCipher:unknown){let key:Buffer|undefined;try{const c=context(rawContext);key=keyCopy(rawKey);return address(decryptScopedWithKey(key,cipher(rawCipher,8192),'axiom.platform.image.upload-grant/1:'+hash(c)),c)}catch{return fail()}finally{key?.fill(0)}}
/** Pure proposal only. The real locked parent/child/grant transaction MUST
 * commit this before credential/key access or PUT and recheck current people. */
export function claimImagePut(rawContext:unknown,rawActor:unknown,now:number,previous:unknown){const c=context(rawContext),actor=platformPrincipalSchema.parse(rawActor);stamp.parse(now);if(previous!==null||hash(actor)!==hash(c.binding.requester)||now<c.native.issuedAt||now>=c.native.expiresAt||now>=Date.parse(c.binding.expiresAt))return fail();return Object.freeze({format:1 as const,purpose:'platform_image_put_claim_v1' as const,actionId:c.binding.actionId,planDigest:c.binding.plan.digest,grantReference:c.binding.grantReference,putIndex:1 as const,contextDigest:hash(c),phase:'claimed' as const,attempt:1 as const,claimedAt:now})}

/** Canonical private record reconstruction, not native qualification. */
export function readImageUploadGrantContext(raw:unknown){return context(raw)}
