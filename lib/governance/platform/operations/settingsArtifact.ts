import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {encryptScopedWithKey,decryptScopedWithKey} from '@/lib/security/credentialVaultCrypto';
import {platformPrincipalSchema,digest,type PlatformPrincipal,type PlatformAction} from '../contracts';
import {compilePlatformPlan,readPlatformAction} from '../kernel';
import {operationalArtifactId,operationalSettingsManifest} from './contracts';
import {readOperationalManifest} from './kernel';
import {operationalWorkloadBinding} from './workloadIdentity';
const entry=operationalSettingsManifest.shape.settings.element;
export const settingsArtifactBindingSchema=z.object({format:z.literal(1),purpose:z.literal('platform_settings_artifact_v1'),artifactId:operationalArtifactId,actionId:operationalWorkloadBinding.shape.actionId,planDigest:digest,manifestDigest:digest,effectIndex:z.number().int().min(0).max(31),effectId:z.string().regex(/^setting_[0-9]{1,2}$/),creator:platformPrincipalSchema,profileId:operationalSettingsManifest.shape.artifactProfileId,target:operationalSettingsManifest.shape.target.extend({name:entry.shape.name,environment:entry.shape.environment,type:entry.shape.type,sensitivity:entry.shape.sensitivity}).strict(),expiresAt:z.string().max(40).datetime()}).strict().refine(v=>v.target.sensitivity!=='secret'||v.target.type==='encrypted');
export type SettingsArtifactBinding=z.infer<typeof settingsArtifactBindingSchema>;
const fail=():never=>{throw Error('settings_artifact_unavailable')};
/** All digests below cover NONSECRET metadata only, never values/envelopes. */
export function compileOperationalSettingsPlan(raw:unknown){
 const manifest=readOperationalManifest(raw);if(manifest.kind!=='settings.vercel')return fail();
 return compilePlatformPlan({format:1,scope:'platform',sourceDigest:manifest.digest,expiresAt:manifest.expiresAt,effects:manifest.settings.map((setting,index)=>({id:'setting_'+index,kind:'settings.vercel',target:{projectId:manifest.target.projectId,settingsDigest:sha256ContentHash({purpose:'platform_settings_effect_v1',manifestDigest:manifest.digest,target:manifest.target,profileId:manifest.artifactProfileId,index,setting})}}))});
}
export function deriveSettingsArtifactBinding(actionId:string,rawParent:PlatformAction,rawManifest:unknown,index:number,rawCreator:PlatformPrincipal):SettingsArtifactBinding{
 try{const parent=readPlatformAction(rawParent),manifest=readOperationalManifest(rawManifest),creator=platformPrincipalSchema.parse(rawCreator);if(manifest.kind!=='settings.vercel')return fail();
  const plan=compileOperationalSettingsPlan(manifest);if(parent.plan.digest!==plan.digest||sha256ContentHash(creator)!==sha256ContentHash(parent.requester)||!Number.isSafeInteger(index)||index<0||index>=manifest.settings.length)return fail();
  const setting=manifest.settings[index],binding=settingsArtifactBindingSchema.parse({format:1,purpose:'platform_settings_artifact_v1',artifactId:setting.artifactId,actionId,planDigest:plan.digest,manifestDigest:manifest.digest,effectIndex:index,effectId:plan.effects[index].id,creator,profileId:manifest.artifactProfileId,target:{...manifest.target,name:setting.name,environment:setting.environment,type:setting.type,sensitivity:setting.sensitivity},expiresAt:manifest.expiresAt});
  Object.freeze(binding.creator);Object.freeze(binding.target);return Object.freeze(binding);
 }catch{return fail()}
}
function keyCopy(raw:unknown){if(!(raw instanceof Uint8Array)||raw.byteLength!==32)return fail();return Buffer.from(raw)}
function checkedValue(raw:unknown){if(typeof raw!=='string'||raw.includes('\0')||Buffer.byteLength(raw,'utf8')>65536||Buffer.from(raw,'utf8').toString('utf8')!==raw)return fail();return raw}
function context(raw:unknown){return 'axiom.platform.settings.artifact/1:'+sha256ContentHash(settingsArtifactBindingSchema.parse(raw))}
/** Private codec only: reuses the existing AES-GCM kernel. No key lookup,
 * environment fallback, storage, role/expiry authority, HTTP or provider action.
 * 64KiB is a local memory bound, not vendor value-size qualification. */
export function sealSettingsArtifact(rawKey:unknown,binding:unknown,rawValue:unknown):string{
 let key:Buffer|undefined;try{const aad=context(binding),value=checkedValue(rawValue);key=keyCopy(rawKey);return encryptScopedWithKey(key,value,aad)}catch{return fail()}finally{key?.fill(0)}
}
export function openSettingsArtifact(rawKey:unknown,binding:unknown,rawCipher:unknown):string{
 let key:Buffer|undefined;try{const aad=context(binding);if(typeof rawCipher!=='string'||rawCipher.length>4*Math.ceil((65536+28)/3)+3||!/^v2\.[A-Za-z0-9_-]+$/.test(rawCipher))return fail();const payload=rawCipher.slice(3),bytes=Buffer.from(payload,'base64url');if(bytes.length<28||bytes.toString('base64url')!==payload)return fail();key=keyCopy(rawKey);return checkedValue(decryptScopedWithKey(key,rawCipher,aad))}catch{return fail()}finally{key?.fill(0)}
}
/** Safe metadata projection accepts no value or envelope and exposes no session,
 * context/ciphertext/value hash, key material or storage/permission assertion. */
export function settingsArtifactMetadata(raw:unknown){const binding=settingsArtifactBindingSchema.parse(raw);return Object.freeze({artifactId:binding.artifactId,actionId:binding.actionId,effectIndex:binding.effectIndex,effectId:binding.effectId,creatorUserId:binding.creator.userId,profileId:binding.profileId,target:Object.freeze({...binding.target}),expiresAt:binding.expiresAt,authority:'metadata_only' as const,executionAuthorized:false as const})}
