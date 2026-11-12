import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {z} from 'zod';
import {readOperationalManifest} from './kernel';
import 'server-only';
import type {PlatformTransaction,PlatformAuthority} from '../actionStore';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import {readPlatformAction,approvePlatformAction} from '../kernel';
import {operationalWorkloadBinding} from './workloadIdentity';
import {deriveSettingsArtifactBinding,sealSettingsArtifact,settingsArtifactMetadata,settingsArtifactBindingSchema,type SettingsArtifactBinding} from './settingsArtifact';
export interface SettingsArtifactTransaction extends PlatformTransaction{
 readSettingsArtifact(artifactId:string):Promise<unknown|null>;
 /** Insert only; uniqueness on artifactId and (actionId,effectIndex) is mandatory.
  * No update/delete/renew API. Must share the locked parent transaction. */
 insertSettingsArtifact(artifactId:string,row:{binding:SettingsArtifactBinding;envelope:string;createdAt:number}):Promise<void>;
}
export interface SettingsArtifactRepository{transaction<T>(fn:(tx:SettingsArtifactTransaction)=>Promise<T>):Promise<T>}
interface PrivateSource{
 readManifest(tx:SettingsArtifactTransaction,actionId:string):Promise<unknown>;
 assertCurrent(tx:SettingsArtifactTransaction,binding:SettingsArtifactBinding):Promise<void>;
 /** Trusted private qualified custody supplier only. No environment fallback. */
 readKey(tx:SettingsArtifactTransaction,binding:SettingsArtifactBinding):Promise<Uint8Array>;
}
const fail=():never=>{throw Error('settings_artifact_unavailable')};
/** Private preparation only. No decrypt/export, provider send or default supplier.
 * Repository implementation must provide transactional rollback and parent locks.
 * The injected authority checks actual current requester permissions/possession. */
export function createSettingsArtifactStore(repo:SettingsArtifactRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:PrivateSource){
 return Object.freeze({async save(rawId:string,index:number,rawActor:PlatformPrincipal,value:unknown){
  try{const id=operationalWorkloadBinding.shape.actionId.parse(rawId),actor=platformPrincipalSchema.parse(rawActor);
   return await repo.transaction(async tx=>{
    await tx.lock(id);await authority.assertCurrent(tx,actor);
    const parent=readPlatformAction(await tx.read(id));if(parent.status!=='proposed')return fail();
    const binding=deriveSettingsArtifactBinding(id,parent,await source.readManifest(tx,id),index,actor);
    async function current(){
     await authority.assertCurrent(tx,actor);await source.assertCurrent(tx,binding);await authority.assertCurrent(tx,actor);
     const actual=readPlatformAction(await tx.read(id)),now=await tx.now();
     if(actual.status!=='proposed'||actual.version!==parent.version||actual.plan.digest!==parent.plan.digest||actual.requester.userId!==actor.userId||actual.requester.sessionId!==actor.sessionId||!Number.isSafeInteger(now)||now<parent.updatedAt||now>=Date.parse(binding.expiresAt))return fail();return now;
    }
    await current();if(await tx.readSettingsArtifact(binding.artifactId))return fail();
    const key=await source.readKey(tx,binding);await current();
    const envelope=sealSettingsArtifact(key,binding,value),createdAt=await current();
    await tx.insertSettingsArtifact(binding.artifactId,{binding,envelope,createdAt});await current();
    return settingsArtifactMetadata(binding);
   });
  }catch{return fail()}
 },async review(rawId:string,version:number,planDigest:string,rawReviewer:PlatformPrincipal){
  try{const id=operationalWorkloadBinding.shape.actionId.parse(rawId),reviewer=platformPrincipalSchema.parse(rawReviewer);
   return await repo.transaction(async tx=>{
    await tx.lock(id);await authority.assertCurrent(tx,reviewer);const parent=readPlatformAction(await tx.read(id));
    if(parent.status!=='proposed'||parent.version!==version||parent.plan.digest!==planDigest||parent.requester.userId===reviewer.userId)return fail();
    const manifest=readOperationalManifest(await source.readManifest(tx,id));if(manifest.kind!=='settings.vercel')return fail();const settingCount=manifest.settings.length;
    async function current(){
     await authority.assertCurrent(tx,parent.requester);await authority.assertCurrent(tx,reviewer);
     for(let index=0;index<settingCount;index++){
      const binding=deriveSettingsArtifactBinding(id,parent,manifest,index,parent.requester);
      await source.assertCurrent(tx,binding);
      const row=z.object({binding:settingsArtifactBindingSchema,envelope:z.string().min(1).max(87423),createdAt:z.number().int().nonnegative()}).strict().parse(await tx.readSettingsArtifact(binding.artifactId));
      if(sha256ContentHash(row.binding)!==sha256ContentHash(binding)||!/^v2\.[A-Za-z0-9_-]+$/.test(row.envelope)||row.createdAt<parent.updatedAt||row.createdAt>=Date.parse(binding.expiresAt))return fail();
     }
     await authority.assertCurrent(tx,parent.requester);await authority.assertCurrent(tx,reviewer);const now=await tx.now();if(!Number.isSafeInteger(now)||now<parent.updatedAt||now>=Date.parse(parent.plan.expiresAt))return fail();return now;
    }
    const next=approvePlatformAction(parent,{...reviewer,planDigest},await current());await tx.replace(id,version,next);await tx.event({actionId:id,kind:'approved',state:next});await current();
    return Object.freeze({actionId:id,planDigest,status:next.status,version:next.version,authority:'review_only' as const,executionAuthorized:false as const});
   });
  }catch{return fail()}
 }});
}
