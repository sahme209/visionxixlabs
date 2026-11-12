import {readSettingsResult} from './settingsResult';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {z} from 'zod';
import {readOperationalManifest} from './kernel';
import 'server-only';
import type {PlatformTransaction,PlatformAuthority} from '../actionStore';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import {readPlatformAction,approvePlatformAction,claimPlatformAction} from '../kernel';
import {operationalWorkloadBinding} from './workloadIdentity';
import {deriveSettingsArtifactBinding,sealSettingsArtifact,settingsArtifactMetadata,settingsArtifactBindingSchema,type SettingsArtifactBinding} from './settingsArtifact';
export interface SettingsArtifactTransaction extends PlatformTransaction{
 readSettingsManifest(actionId:string):Promise<unknown>;
 readSettingsResults(actionId:string):Promise<unknown[]>;
 assertSettingsCreationHeld(binding:SettingsArtifactBinding):Promise<void>;
 reserveSettingsCreation(binding:SettingsArtifactBinding):Promise<string>;
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
function checkedRecord(raw:unknown,binding:SettingsArtifactBinding,earliest:number){
 const row=z.object({binding:settingsArtifactBindingSchema,envelope:z.string().min(1).max(87423),createdAt:z.number().int().nonnegative()}).strict().parse(raw);
 if(sha256ContentHash(row.binding)!==sha256ContentHash(binding)||!/^v2\.[A-Za-z0-9_-]+$/.test(row.envelope)||row.createdAt<earliest||row.createdAt>=Date.parse(binding.expiresAt))return fail();return row;
}

/** Private preparation only. No decrypt/export, provider send or default supplier.
 * Repository implementation must provide transactional rollback and parent locks.
 * The injected authority checks actual current requester permissions/possession. */
export function createSettingsArtifactStore(repo:SettingsArtifactRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:PrivateSource){
 return Object.freeze({async inspect(rawId:string,rawReader:PlatformPrincipal){
  try{const id=operationalWorkloadBinding.shape.actionId.parse(rawId),reader=platformPrincipalSchema.parse(rawReader);return await repo.transaction(async tx=>{
   await tx.lock(id);await authority.assertCurrent(tx,reader);const parent=readPlatformAction(await tx.read(id));if(parent.plan.effects.some(e=>e.kind!=='settings.vercel'))return fail();
   const raw=await tx.readSettingsResults(id);if(!Array.isArray(raw)||raw.length>32)return fail();const results=raw.map(readSettingsResult),seen=new Set<number>();
   for(const result of results){if(result.actionId!==id||result.planDigest!==parent.plan.digest||result.manifestDigest!==parent.plan.sourceDigest||result.effectIndex>=parent.plan.effects.length||seen.has(result.effectIndex))return fail();seen.add(result.effectIndex)}
   await authority.assertCurrent(tx,reader);const now=await tx.now();if(!Number.isSafeInteger(now)||now<parent.updatedAt)return fail();
   return Object.freeze({actionId:id,planDigest:parent.plan.digest,status:parent.status,version:parent.version,attemptCount:parent.attemptCount,requesterUserId:parent.requester.userId,reviewerUserId:parent.reviewer?.userId??null,expired:now>=Date.parse(parent.plan.expiresAt),results:Object.freeze(results),authority:'history_only' as const,sourceValidation:'not_checked' as const,executionAuthorized:false as const});
  })}catch{return fail()}
 },async preview(rawId:string,rawReader:PlatformPrincipal){
  try{const id=operationalWorkloadBinding.shape.actionId.parse(rawId),reader=platformPrincipalSchema.parse(rawReader);return await repo.transaction(async tx=>{
   await tx.lock(id);await authority.assertCurrent(tx,reader);const parent=readPlatformAction(await tx.read(id));if(parent.status!=='proposed')return fail();
   const manifest=readOperationalManifest(await source.readManifest(tx,id));if(manifest.kind!=='settings.vercel')return fail();
   const settings=[];
   for(let index=0;index<manifest.settings.length;index++){
    const binding=deriveSettingsArtifactBinding(id,parent,manifest,index,parent.requester);await source.assertCurrent(tx,binding);
    const row=await tx.readSettingsArtifact(binding.artifactId);if(row!==null)checkedRecord(row,binding,parent.updatedAt);await source.assertCurrent(tx,binding);
    const descriptor=manifest.settings[index];settings.push(Object.freeze({name:descriptor.name,environment:descriptor.environment,type:descriptor.type,sensitivity:descriptor.sensitivity,current:descriptor.current,artifactId:binding.artifactId,artifactStatus:row===null?'missing' as const:'saved' as const}));
   }
   await authority.assertCurrent(tx,parent.requester);await authority.assertCurrent(tx,reader);const now=await tx.now();if(!Number.isSafeInteger(now)||now<parent.updatedAt||now>=Date.parse(parent.plan.expiresAt))return fail();
   return Object.freeze({actionId:id,planDigest:parent.plan.digest,version:parent.version,target:manifest.target,profileId:manifest.artifactProfileId,expiresAt:manifest.expiresAt,settings:Object.freeze(settings),reviewReady:settings.every(s=>s.artifactStatus==='saved'),authority:'review_preview_only' as const,executionAuthorized:false as const});
  })}catch{return fail()}
 },async save(rawId:string,index:number,rawActor:PlatformPrincipal,value:unknown){
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
 },async claim(rawId:string,version:number,planDigest:string,rawRequester:PlatformPrincipal){
  try{const id=operationalWorkloadBinding.shape.actionId.parse(rawId),actor=platformPrincipalSchema.parse(rawRequester);return await repo.transaction(async tx=>{
   await tx.lock(id);await authority.assertCurrent(tx,actor);const parent=readPlatformAction(await tx.read(id));
   if(parent.status!=='approved'||parent.version!==version||parent.plan.digest!==planDigest||parent.requester.userId!==actor.userId||parent.requester.sessionId!==actor.sessionId||!parent.reviewer)return fail();
   const manifest=readOperationalManifest(await source.readManifest(tx,id));if(manifest.kind!=='settings.vercel'||manifest.settings.some(s=>s.current.kind!=='absent'))return fail();const count=manifest.settings.length,reviewer=parent.reviewer;
   async function current(){
    await authority.assertCurrent(tx,actor);await authority.assertCurrent(tx,reviewer);
    for(let index=0;index<count;index++){
     const binding=deriveSettingsArtifactBinding(id,parent,manifest,index,actor);await source.assertCurrent(tx,binding);
     const row=checkedRecord(await tx.readSettingsArtifact(binding.artifactId),binding,0);if(row.createdAt>parent.updatedAt)return fail();await source.assertCurrent(tx,binding);
    }
    await authority.assertCurrent(tx,actor);await authority.assertCurrent(tx,reviewer);const now=await tx.now();if(!Number.isSafeInteger(now)||now<parent.updatedAt||now>=Date.parse(parent.plan.expiresAt))return fail();return now;
   }
   const next=claimPlatformAction(parent,actor,await current());await tx.replace(id,version,next);await tx.event({actionId:id,kind:'claimed',state:next});await current();
   return Object.freeze({actionId:id,planDigest,status:next.status,version:next.version,attemptCount:next.attemptCount,authority:'claim_record_only' as const,executionAuthorized:false as const});
  })}catch{return fail()}
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
      checkedRecord(await tx.readSettingsArtifact(binding.artifactId),binding,parent.updatedAt);await source.assertCurrent(tx,binding);
     }
     await authority.assertCurrent(tx,parent.requester);await authority.assertCurrent(tx,reviewer);const now=await tx.now();if(!Number.isSafeInteger(now)||now<parent.updatedAt||now>=Date.parse(parent.plan.expiresAt))return fail();return now;
    }
    const next=approvePlatformAction(parent,{...reviewer,planDigest},await current());await tx.replace(id,version,next);await tx.event({actionId:id,kind:'approved',state:next});await current();
    return Object.freeze({actionId:id,planDigest,status:next.status,version:next.version,authority:'review_only' as const,executionAuthorized:false as const});
   });
  }catch{return fail()}
 }});
}
