import {createSettingsTimePolicy,type SettingsTiming,type SettingsTimeEvidenceSource} from './settingsTime';
import {platformPreparationRequestId} from '../preparationContract';
import 'server-only';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import type {PlatformAuthority} from '../actionStore';
import {preparationActionReference} from '../preparationReference';
import {createPlatformAction,readPlatformAction} from '../kernel';
import {operationalSettingsManifest} from './contracts';
import {compileOperationalManifest,readOperationalManifest,type OperationalManifest} from './kernel';
import {compileOperationalSettingsPlan} from './settingsArtifact';
import type {SettingsArtifactRepository,SettingsArtifactTransaction} from './settingsArtifactStore';
export type SettingsManifest=Extract<OperationalManifest,{kind:'settings.vercel'}>;
export interface SettingsPreparationSource extends SettingsTimeEvidenceSource{assertCurrent(tx:SettingsArtifactTransaction,manifest:SettingsManifest):Promise<void>}
const fail=():never=>{throw Error('settings_preparation_unavailable')};
/** Exact metadata preparation; supplier must independently qualify selected
 * current metadata. Client receipts/digests never establish source authority. */
export function createSettingsPreparationStore(repo:SettingsArtifactRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:SettingsPreparationSource,timing?:SettingsTiming){
 const time=createSettingsTimePolicy(source,timing);
 return Object.freeze({async prepare(raw:unknown,requestId:string,rawActor:PlatformPrincipal){
  try{requestId=platformPreparationRequestId.parse(requestId);const selection=operationalSettingsManifest.parse(raw);if(selection.settings.some(s=>s.current.kind!=='absent'))return fail();const manifest=compileOperationalManifest(selection);if(manifest.kind!=='settings.vercel')return fail();const actor=platformPrincipalSchema.parse(rawActor),id=preparationActionReference(requestId,actor,'platform_settings_preparation_v1'),plan=compileOperationalSettingsPlan(manifest);
   return await repo.transaction(async tx=>{
    await tx.lock(id);await authority.assertCurrent(tx,actor);const existing=await tx.read(id);
    if(existing){const parent=readPlatformAction(existing),saved=readOperationalManifest(await tx.readSettingsManifest(id));if(parent.requester.userId!==actor.userId||parent.requester.sessionId!==actor.sessionId||parent.plan.digest!==plan.digest||saved.digest!==manifest.digest)return fail();await authority.assertCurrent(tx,actor);return Object.freeze({requestId,actionId:id,historical:true,authority:'proposal_reference_only',executionAuthorized:false})}
    const sourceCurrent=async()=>{await source.assertCurrent(tx,manifest);await authority.assertCurrent(tx,actor);const now=await tx.now();if(!Number.isSafeInteger(now)||now<0||now>=Date.parse(manifest.expiresAt))return fail();return now}
    async function current(){const before=await sourceCurrent();await time(tx,[actor],manifest);const after=await sourceCurrent();if(after<before)return fail();return after}
    const now=await current(),parent=createPlatformAction(plan,actor,now);
    await tx.insert(id,parent);await tx.event({actionId:id,kind:'proposed',state:parent,settingsManifest:manifest});const after=await current();if(after<now)return fail();return Object.freeze({requestId,actionId:id,historical:false,authority:'proposal_reference_only',executionAuthorized:false});
   });
  }catch{return fail()}
 },async lookup(requestId:string,rawActor:PlatformPrincipal){
  try{requestId=platformPreparationRequestId.parse(requestId);const actor=platformPrincipalSchema.parse(rawActor),id=preparationActionReference(requestId,actor,'platform_settings_preparation_v1');return await repo.transaction(async tx=>{
   await tx.lock(id);await authority.assertCurrent(tx,actor);const raw=await tx.read(id);if(raw){const parent=readPlatformAction(raw),manifest=readOperationalManifest(await tx.readSettingsManifest(id));if(manifest.kind!=='settings.vercel'||parent.requester.userId!==actor.userId||parent.requester.sessionId!==actor.sessionId||compileOperationalSettingsPlan(manifest).digest!==parent.plan.digest)return fail()}
   await authority.assertCurrent(tx,actor);return Object.freeze({requestId,found:raw!==null,actionId:id,authority:'history_only',executionAuthorized:false});
  })}catch{return fail()}
 }});
}
