import 'server-only';
import {z} from 'zod';
import {assertPlatformParticipantsTime,readPlatformPrincipalTimeWindow} from '../principalTime';
import type {ExecutionTimeSource,ExecutionTimeCheck} from '../executionTime';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import type {SettingsArtifactTransaction} from './settingsArtifactStore';
import {settingsArtifactBindingSchema} from './settingsArtifact';
import {readOperationalManifest} from './kernel';
export interface SettingsTimeContext{readonly manifestDigest:string;readonly profileId:string;readonly expiresAt:number}
export interface SettingsTimeEvidenceSource{
 /** Exact private qualified source/profile validity, not request JSON. Missing
  * native provenance is not repaired by returning structurally matching fields. */
 readTimeWindow?(tx:SettingsArtifactTransaction,context:Readonly<SettingsTimeContext>):Promise<unknown>;
}
export interface SettingsTiming{clock:ExecutionTimeSource;signal?:AbortSignal}
const stamp=z.number().int().nonnegative().safe(),window=z.object({manifestDigest:z.string().regex(/^[a-f0-9]{64}$/),profileId:z.string().min(1).max(128),notBefore:stamp,expiresAt:stamp}).strict();
const fail=():never=>{throw Error('settings_time_unavailable')};
function context(raw:unknown):Readonly<SettingsTimeContext>{
 if(raw&&typeof raw==='object'&&'kind' in raw){const manifest=readOperationalManifest(raw);if(manifest.kind!=='settings.vercel')return fail();return Object.freeze({manifestDigest:manifest.digest,profileId:manifest.artifactProfileId,expiresAt:stamp.parse(Date.parse(manifest.expiresAt))})}
 const binding=settingsArtifactBindingSchema.parse(raw);return Object.freeze({manifestDigest:binding.manifestDigest,profileId:binding.profileId,expiresAt:stamp.parse(Date.parse(binding.expiresAt))});
}
/** Supplemental time, not current-role/source authority. The original locked
 * owner supplies its exact final current-source/people checks as afterTime;
 * equality is checked after those awaits before any result is returned.
 * No Date/DB fallback, cached interval or new capability is installed. */
export function createSettingsTimePolicy(source:SettingsTimeEvidenceSource,timing?:SettingsTiming){
 const read=source.readTimeWindow?.bind(source),clock=timing?.clock,signal=timing?.signal;
 return async<T>(tx:SettingsArtifactTransaction,people:readonly PlatformPrincipal[],rawContext:unknown,afterTime:()=>Promise<T>,nativeCheck?:ExecutionTimeCheck,finalNativeFacts?:()=>Promise<void>):Promise<T>=>{
  try{
   if(typeof clock!=='function'||typeof read!=='function'||!(signal instanceof AbortSignal))return fail();signal.throwIfAborted();
   const principals=people.map(p=>platformPrincipalSchema.parse(p));if(!principals.length)return fail();
   const expected=context(rawContext),evidence=window.parse(await read(tx,expected));signal.throwIfAborted();
   if(evidence.manifestDigest!==expected.manifestDigest||evidence.profileId!==expected.profileId||evidence.notBefore>=evidence.expiresAt)return fail();
   const restriction={notBefore:evidence.notBefore,expiresAt:Math.min(expected.expiresAt,evidence.expiresAt)};
   if(nativeCheck!==undefined){if(typeof nativeCheck!=='function')return fail();for(const principal of principals){const session=await readPlatformPrincipalTimeWindow(tx,principal,signal);restriction.notBefore=Math.max(restriction.notBefore,session.notBefore);restriction.expiresAt=Math.min(restriction.expiresAt,session.expiresAt)}await nativeCheck(Object.freeze(restriction))}
   else await assertPlatformParticipantsTime(tx,principals,clock,restriction,signal);signal.throwIfAborted();
   const result=await afterTime();signal.throwIfAborted();
   const after=window.parse(await read(tx,expected));signal.throwIfAborted();
   if(after.manifestDigest!==evidence.manifestDigest||after.profileId!==evidence.profileId||after.notBefore!==evidence.notBefore||after.expiresAt!==evidence.expiresAt)return fail();if(finalNativeFacts){if(typeof nativeCheck!=='function')return fail();await finalNativeFacts();signal.throwIfAborted()}return result;
  }catch{return fail()}
 };
}
