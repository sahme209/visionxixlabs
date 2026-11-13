import {createSettingsTimePolicy,type SettingsTiming,type SettingsTimeEvidenceSource} from './settingsTime';
import type {ExecutionTimeSource,ExecutionTimeAuthorization,ExecutionTimeCheck} from '../executionTime';
import {createSettingsResult} from './settingsResult';
import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createPlatformActionService,type PlatformAuthority,type PlatformRepository,type PlatformTransaction} from '../actionStore';
import {readPlatformAction} from '../kernel';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import {bindPlatformExecution,runPlatformEffect} from '../effectExecution';
import {readOperationalManifest} from './kernel';
import {compileOperationalSettingsPlan,deriveSettingsArtifactBinding,settingsArtifactBindingSchema,openSettingsArtifact,type SettingsArtifactBinding} from './settingsArtifact';
import type {SettingsArtifactRepository,SettingsArtifactTransaction} from './settingsArtifactStore';
interface Source extends SettingsTimeEvidenceSource{
 readManifest(tx:SettingsArtifactTransaction,id:string):Promise<unknown>;
 assertCurrent(tx:SettingsArtifactTransaction,binding:SettingsArtifactBinding):Promise<void>;
 assertWriteProfile(tx:SettingsArtifactTransaction,binding:SettingsArtifactBinding):Promise<void>;
 readKey(tx:SettingsArtifactTransaction,binding:SettingsArtifactBinding):Promise<Uint8Array>;
}
interface Transport{
 readonly clock?:ExecutionTimeSource;
 readonly signal?:AbortSignal;
 /** Private source-qualified transport only: one exact create, never upsert,
  * no retries or implicit deployment. Must invoke beforeSend immediately before
  * its outbound attempt and verify the exact receipt, excluding raw values. */
 send(binding:SettingsArtifactBinding,value:string,beforeSend:ExecutionTimeAuthorization,beforeCredential:ExecutionTimeAuthorization):Promise<unknown>;
}
const resultSchema=z.discriminatedUnion('outcome',[
 z.object({outcome:z.literal('confirmed'),settingId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/)}).strict(),
 z.object({outcome:z.enum(['refused','unknown'])}).strict(),
]);
const recordSchema=z.object({binding:settingsArtifactBindingSchema,envelope:z.string().max(87423),createdAt:z.number().int().nonnegative()}).strict();
const fail=():never=>{throw Error('settings_execution_unavailable')};
/** Server-private candidate: no default credential/profile/transport supplier,
 * public HTTP mount or provider qualification. Actual ports remain explicit. */
export function createSettingsExecutor(repo:SettingsArtifactRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:Source,transport:Transport,timing?:SettingsTiming){
 const clock=timing?.clock,signal=timing?.signal,time=createSettingsTimePolicy(source,timing);
 return Object.freeze({async executeNext(id:string,rawActor:PlatformPrincipal,expectedEffectIndex:number){
  try{if(typeof clock!=='function'||!(signal instanceof AbortSignal)||transport.clock!==clock||transport.signal!==signal)return fail();signal.throwIfAborted();if(!Number.isSafeInteger(expectedEffectIndex)||expectedEffectIndex<0||expectedEffectIndex>31)return fail();const actor=platformPrincipalSchema.parse(rawActor);
   async function sourceCurrent(tx:SettingsArtifactTransaction,index:number,held:boolean){
    const parent=readPlatformAction(await tx.read(id));if(parent.status!=='claimed'||parent.requester.userId!==actor.userId||parent.requester.sessionId!==actor.sessionId||!parent.reviewer)return fail();
    await authority.assertCurrent(tx,actor);await authority.assertCurrent(tx,parent.reviewer);
    const manifest=readOperationalManifest(await source.readManifest(tx,id));if(manifest.kind!=='settings.vercel'||manifest.settings.some(s=>s.current.kind!=='absent')||compileOperationalSettingsPlan(manifest).digest!==parent.plan.digest)return fail();
    const binding=deriveSettingsArtifactBinding(id,parent,manifest,index,actor);await source.assertCurrent(tx,binding);await source.assertWriteProfile(tx,binding);
    const record=recordSchema.parse(await tx.readSettingsArtifact(binding.artifactId));if(sha256ContentHash(record.binding)!==sha256ContentHash(binding)||record.createdAt>parent.updatedAt||record.createdAt>=Date.parse(binding.expiresAt))return fail();
    if(held)await tx.assertSettingsCreationHeld(binding);
    await source.assertCurrent(tx,binding);await source.assertWriteProfile(tx,binding);await authority.assertCurrent(tx,actor);await authority.assertCurrent(tx,parent.reviewer);
    const now=await tx.now();if(!Number.isSafeInteger(now)||now<parent.updatedAt||now>=Date.parse(binding.expiresAt))return fail();return {binding,record};
   }
   async function current(tx:SettingsArtifactTransaction,index:number,held:boolean,nativeCheck?:ExecutionTimeCheck){
    const before=await sourceCurrent(tx,index,held),parent=readPlatformAction(await tx.read(id));if(!parent.reviewer)return fail();
    await time(tx,[actor,parent.reviewer],before.binding,nativeCheck);const after=await sourceCurrent(tx,index,held);signal!.throwIfAborted();if(sha256ContentHash(before.binding)!==sha256ContentHash(after.binding))return fail();return after;
   }
   let nativeFinal:{check:ExecutionTimeCheck;consumed:boolean}|undefined;
   // Reuse the real child/proof/outcome machinery. The repository wrapper adds
   // reservation in the SAME child-claim transaction, before commit/custody.
   let resultBinding:SettingsArtifactBinding|undefined,confirmedSettingId:string|null=null;
   const extended=new WeakMap<PlatformTransaction,SettingsArtifactTransaction>();
   const wrapped:PlatformRepository={transaction:fn=>repo.transaction(tx=>{const view:PlatformTransaction={...tx,
    async event(event){
     if(event.kind==='effect.observed'){
      if(!resultBinding||event.actionId!==id||event.effectIndex!==resultBinding.effectIndex||!event.outcome||event.outcome==='claimed')return fail();
      const settingsResult=createSettingsResult(resultBinding,event.outcome,event.outcome==='confirmed'?confirmedSettingId:null,await tx.now());await tx.event({...event,settingsResult});
     }else await tx.event(event);
    },
    async writeEffect(actionId,index,expected,status){
     if(actionId!==id||index!==expectedEffectIndex)return fail();if(expected===null&&status==='claimed'){
      const {binding}=await current(tx,index,false);await tx.writeEffect(actionId,index,expected,status);await tx.reserveSettingsCreation(binding);await current(tx,index,true);resultBinding=binding;
     }else await tx.writeEffect(actionId,index,expected,status);
    },
   };extended.set(view,tx);return fn(view)})};
   const service=createPlatformActionService(wrapped,{assertCurrent:authority.assertCurrent,async assertEffectCurrent(tx,effect){
    // Service uses the same private repository wrapper; no cast from client data.
    const parent=readPlatformAction(await tx.read(id)),index=parent.plan.effects.findIndex(e=>sha256ContentHash(e)===sha256ContentHash(effect));if(index<0)return fail();
    // Resolve the extended transaction through the enclosing repository below.
    const actual=extended.get(tx);if(!actual)return fail();await current(actual,index,true);
   },async assertFinalSend(tx,effect){
    const active=nativeFinal,actual=extended.get(tx);if(!active||active.consumed||!actual||!resultBinding||sha256ContentHash(effect)!==sha256ContentHash(readPlatformAction(await tx.read(id)).plan.effects[resultBinding.effectIndex]))return fail();
    await current(actual,resultBinding.effectIndex,true,active.check);active.consumed=true;
   }});
   let expectedIndex=-1;
   const expected=await repo.transaction(async tx=>{await tx.lock(id);const parent=readPlatformAction(await tx.read(id));if(parent.status!=='claimed')return fail();for(let i=0;i<parent.plan.effects.length;i++){const state=await tx.readEffect(id,i);if(state==='confirmed')continue;if(state!==null||i!==expectedEffectIndex)return fail();await current(tx,i,false);expectedIndex=i;return parent.plan.effects[i]}return fail()});
   const bound=bindPlatformExecution({claimNextEffect:key=>service.claimNextEffect(key,actor),beforeEffectSend:(proof,effect)=>service.beforeEffectSend(proof,effect,actor),observeEffect:service.observeEffect},id);
   return await runPlatformEffect(bound,expected,async beforeSend=>{
    let value:string|undefined;
    try{
     const opened=await repo.transaction(async tx=>{await tx.lock(id);const checked=await current(tx,expectedIndex,true),key=await source.readKey(tx,checked.binding);await current(tx,expectedIndex,true);const plain=openSettingsArtifact(key,checked.binding,checked.record.envelope);await current(tx,expectedIndex,true);return {binding:checked.binding,plain}});
     value=opened.plain;
     let nativeUsed=false;
     const result=resultSchema.parse(await transport.send(opened.binding,value,async check=>{
      if(nativeUsed||typeof check!=='function')return fail();nativeUsed=true;const active={check,consumed:false};nativeFinal=active;
      try{await beforeSend();if(!active.consumed)return fail()}finally{nativeFinal=undefined}
     },async check=>{if(typeof check!=='function')return fail();await repo.transaction(async tx=>{await tx.lock(id);await current(tx,expectedIndex,true,check)})}));if(result.outcome==='confirmed')confirmedSettingId=result.settingId;
     return {outcome:result.outcome,value:result.outcome==='confirmed'?Object.freeze({actionId:id,effectIndex:expectedIndex,settingId:result.settingId,status:'provider_confirmed' as const,deploymentPerformed:false as const}):null};
    }finally{value=undefined}
   });
  }catch{return fail()}
 }});
}
