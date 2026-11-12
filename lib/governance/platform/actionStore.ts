import 'server-only';
import {createHash} from 'node:crypto';
import {readPlatformTemplateBytes} from '@/lib/cloud/aws/platformTemplateSource';
import {platformTemplatePreview} from './templateContract';
import {prepareDeploymentPlatformPlan,matchesDeploymentSelection} from './deploymentPreparation';
import {platformDeploymentSelection,platformDeploymentPreview} from './deploymentContract';
import {platformSourceKind,platformSourceId,projectPlatformSources,type PlatformSourceKind} from './sourceCatalog';
import {projectPlatformHistory} from './historyProjection';
import {platformHistoryCursor,type PlatformHistoryCursor} from './historyContract';
import {preparationActionReference,canonicalGrowthSelection,matchesPreparationSelection} from './preparationReference';
import {prepareGrowthPlatformPlan} from './growthPreparation';
import {platformInspectionSchema,platformGrowthPreviewSchema} from './viewContract';
import {randomUUID} from 'node:crypto';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createPlatformAction,approvePlatformAction,claimPlatformAction,finishPlatformAction,readPlatformAction} from './kernel';
import {platformEffectSchema,platformPrincipalSchema,type PlatformPlan,type PlatformAction,type PlatformPrincipal,type PlatformEffect} from './contracts';
export type EffectStatus='claimed'|'confirmed'|'refused'|'unknown';
export interface PlatformTransaction{
 readDeploymentSource?(leadId:string):Promise<unknown>;
 readSourcePage?(kind:PlatformSourceKind,cursor:string|null):Promise<unknown>;
 readActionPage?(cursor:PlatformHistoryCursor|null):Promise<unknown>;
 readGrowthDeletionSource?(draftId:string,connectionId:string):Promise<unknown>;
 readGrowthPostingSource(draftId:string,connectionId:string):Promise<unknown>;
 readSessionPrincipal(sessionId:string):Promise<unknown>;
 readPrincipal(principal:PlatformPrincipal):Promise<unknown>;
 now():Promise<number>;lock(id:string):Promise<void>;read(id:string):Promise<unknown|null>;
 insert(id:string,state:PlatformAction):Promise<void>;replace(id:string,expectedVersion:number,state:PlatformAction):Promise<void>;
 event(event:{actionId:string;kind:'proposed'|'approved'|'claimed'|'effect.claimed'|'effect.observed';state:PlatformAction;effectIndex?:number;outcome?:EffectStatus}):Promise<void>;
 /** Permanent send reservation. No release/reset API, including unknown outcomes. */
 reservePostDeletion?(id:string,index:number,postUrn:string):Promise<void>;
 reservePublication?(id:string,index:number,draftId:string):Promise<void>;
 readEffect(id:string,index:number):Promise<unknown|null>;
 writeEffect(id:string,index:number,expected:unknown|null,status:EffectStatus):Promise<void>;
}
export interface PlatformRepository{transaction<T>(fn:(tx:PlatformTransaction)=>Promise<T>):Promise<T>}
export interface PlatformAuthority{
 /** Trusted server supplier only; validates current stable identity, session and
  * current platform role. A test port is not a production authority source. */
 assertCurrent(tx:PlatformTransaction,principal:PlatformPrincipal):Promise<void>;
 assertEffectCurrent?(tx:PlatformTransaction,effect:PlatformEffect):Promise<void>;
}
const fail=():never=>{throw Error('platform_governance_action_unavailable')};
/** Local store composition. No route or provider may accept a client-built
 * authority supplier, claim or observation proof. Default mounting is separate. */
export function createPlatformActionService(repo:PlatformRepository,authority:PlatformAuthority){
 const observations=new WeakMap<object,{actionId:string;index:number;sendUsed:boolean;sendGranted:boolean}>();
 async function load(tx:PlatformTransaction,id:string){const row=await tx.read(id);if(!row)fail();return readPlatformAction(row)}
 async function actors(tx:PlatformTransaction,state:PlatformAction){await authority.assertCurrent(tx,state.requester);if(state.reviewer)await authority.assertCurrent(tx,state.reviewer)}
 async function timely(tx:PlatformTransaction,state:PlatformAction){const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt||now>=Date.parse(state.plan.expiresAt))fail();return now}
 async function locked<T>(id:string,fn:(tx:PlatformTransaction,state:PlatformAction)=>Promise<T>){
  if(typeof id!=='string'||!/^platform_action_[a-f0-9-]{36}$/.test(id))fail();
  return repo.transaction(async tx=>{await tx.lock(id);return fn(tx,await load(tx,id))});
 }
 return {
  async sources(rawKind:PlatformSourceKind,rawCursor:string|null,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal),kind=platformSourceKind.parse(rawKind),cursor=rawCursor===null?null:platformSourceId.parse(rawCursor);
   return repo.transaction(async tx=>{
    await tx.lock('platform-source-directory');await authority.assertCurrent(tx,actor);
    if(!tx.readSourcePage)return fail();const page=projectPlatformSources(kind,await tx.readSourcePage(kind,cursor),cursor);
    await authority.assertCurrent(tx,actor);return page;
   });
  },
  async history(rawCursor:PlatformHistoryCursor|null,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal),cursor=rawCursor===null?null:platformHistoryCursor.parse(rawCursor);
   return repo.transaction(async tx=>{
    await tx.lock('platform-history-directory');await authority.assertCurrent(tx,actor);
    if(!tx.readActionPage)return fail();
    const page=projectPlatformHistory(await tx.readActionPage(cursor),cursor);
    await authority.assertCurrent(tx,actor);return page;
   });
  },
  /** Historical evidence only: current reader authority is required, but a
   * revoked former approver must not make the consumed record disappear.
   * This DTO intentionally excludes session IDs and every capability proof. */
  async inspect(id:string,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal);
   return locked(id,async(tx,state)=>{
    await authority.assertCurrent(tx,actor);
    const effects=[];
    for(let index=0;index<state.plan.effects.length;index++){
     const status=await tx.readEffect(id,index);
     if(status!==null&&!['claimed','confirmed','refused','unknown'].includes(String(status)))fail();
     effects.push({id:state.plan.effects[index].id,status:status===null?'not_started':String(status)});
    }
    const now=await tx.now();if(!Number.isSafeInteger(now)||now<state.updatedAt)fail();
    await authority.assertCurrent(tx,actor);
    return platformInspectionSchema.parse({actionId:id,version:state.version,status:state.status,attemptCount:state.attemptCount,requesterUserId:state.requester.userId,reviewerUserId:state.reviewer?.userId??null,plan:state.plan,expired:now>=Date.parse(state.plan.expiresAt),effects,authority:'history_only',sourceValidation:'not_checked'});
   });
  },
  async previewTemplate(id:string,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal);
   return locked(id,async(tx,state)=>{
    await authority.assertCurrent(tx,actor);if(!['proposed','approved'].includes(state.status)||state.plan.effects.length!==1)fail();
    const effect=state.plan.effects[0];if(effect.kind!=='template.object.put'&&effect.kind!=='template.access.grant')return fail();
    const bytes=await readPlatformTemplateBytes(),bytesDigest=createHash('sha256').update(bytes).digest('hex');
    if(bytesDigest!==effect.target.bytesDigest)fail();
    const yaml=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    await authority.assertCurrent(tx,actor);await timely(tx,state);
    return platformTemplatePreview.parse({kind:'template.source',actionId:id,planDigest:state.plan.digest,sourceDigest:state.plan.sourceDigest,effectId:effect.id,bytesDigest,yaml,authority:'review_preview_only'});
   });
  },
  async previewDeployment(id:string,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal);
   return locked(id,async(tx,state)=>{
    await authority.assertCurrent(tx,actor);if(!['proposed','approved'].includes(state.status)||state.plan.effects.length!==1)fail();
    const effect=state.plan.effects[0];if(effect.kind!=='deployment.vercel'||!effect.target.leadId||!effect.target.leadRevision)return fail();
    const prepared=await prepareDeploymentPlatformPlan(tx,{leadId:effect.target.leadId,projectName:effect.target.projectName,environment:effect.target.environment,expiresAt:state.plan.expiresAt},effect.id);
    if(prepared.plan.digest!==state.plan.digest)fail();await authority.assertCurrent(tx,actor);await timely(tx,state);
    return platformDeploymentPreview.parse({kind:'deployment.vercel',actionId:id,planDigest:state.plan.digest,sourceDigest:state.plan.sourceDigest,effectId:effect.id,files:prepared.files,authority:'review_preview_only'});
   });
  },
  async lookupDeploymentPreparation(requestId:string,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal),id=preparationActionReference(requestId,actor,'platform_deployment_preparation_v1');
   return repo.transaction(async tx=>{await tx.lock(id);await authority.assertCurrent(tx,actor);const raw=await tx.read(id);
    if(raw){const state=readPlatformAction(raw);if(state.requester.userId!==actor.userId||state.requester.sessionId!==actor.sessionId)fail()}
    await authority.assertCurrent(tx,actor);return raw?{found:true as const,actionId:id,authority:'history_only' as const}:{found:false as const,authority:'history_only' as const};
   });
  },
  async prepareDeployment(raw:unknown,principal:PlatformPrincipal,requestId:string){
   const actor=platformPrincipalSchema.parse(principal),selected=platformDeploymentSelection.parse(raw),id=preparationActionReference(requestId,actor,'platform_deployment_preparation_v1');
   return repo.transaction(async tx=>{await tx.lock(id);await authority.assertCurrent(tx,actor);const existing=await tx.read(id);
    if(existing){const state=readPlatformAction(existing);if(state.requester.userId!==actor.userId||state.requester.sessionId!==actor.sessionId||!matchesDeploymentSelection(state.plan,selected))fail();await authority.assertCurrent(tx,actor);return {actionId:id,historical:true as const,authority:'proposal_reference_only' as const}}
    const prepared=await prepareDeploymentPlatformPlan(tx,selected),state=createPlatformAction(prepared.plan,actor,await tx.now());
    if(!authority.assertEffectCurrent)fail();await authority.assertEffectCurrent!(tx,state.plan.effects[0]);await tx.insert(id,state);await authority.assertCurrent(tx,actor);await timely(tx,state);await tx.event({actionId:id,kind:'proposed',state});
    return {actionId:id,historical:false as const,authority:'proposal_reference_only' as const};
   });
  },
  async previewGrowth(id:string,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal);
   return locked(id,async(tx,state)=>{
    await authority.assertCurrent(tx,actor);
    if(!['proposed','approved'].includes(state.status)||state.plan.effects.length!==1)fail();
    const effect=state.plan.effects[0];if(effect.kind!=='growth.post.publish'&&effect.kind!=='growth.post.delete'&&effect.kind!=='growth.schedule.change')return fail();
    const operation=effect.kind==='growth.post.publish'?'publish':effect.kind==='growth.post.delete'?'delete':'schedule';
    const prepared=await prepareGrowthPlatformPlan(tx,{operation,draftId:effect.target.draftId,connectionId:effect.target.connectionId,expiresAt:state.plan.expiresAt,...(effect.kind==='growth.schedule.change'?{scheduledFor:effect.target.scheduledFor}:{})},await tx.now(),effect.id);
    if(prepared.plan.digest!==state.plan.digest)fail();
    await authority.assertCurrent(tx,actor);await timely(tx,state);
    return platformGrowthPreviewSchema.parse({actionId:id,planDigest:state.plan.digest,...prepared.preview,authority:'review_preview_only'});
   });
  },
  async lookupGrowthPreparation(requestId:string,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal),id=preparationActionReference(requestId,actor);
   return repo.transaction(async tx=>{
    await tx.lock(id);await authority.assertCurrent(tx,actor);const raw=await tx.read(id);
    if(raw){const state=readPlatformAction(raw);if(state.requester.userId!==actor.userId||state.requester.sessionId!==actor.sessionId)fail()}
    await authority.assertCurrent(tx,actor);
    return raw?{found:true as const,actionId:id,authority:'history_only' as const}:{found:false as const,authority:'history_only' as const};
   });
  },
  async prepareGrowth(raw:unknown,principal:PlatformPrincipal,requestId?:string){
   const actor=platformPrincipalSchema.parse(principal),selected=canonicalGrowthSelection(raw),id=requestId===undefined?'platform_action_'+randomUUID():preparationActionReference(requestId,actor);
   return repo.transaction(async tx=>{
    await tx.lock(id);await authority.assertCurrent(tx,actor);
    const existing=await tx.read(id);
    if(existing){
     const original=readPlatformAction(existing);
     if(requestId===undefined||original.requester.userId!==actor.userId||original.requester.sessionId!==actor.sessionId||!matchesPreparationSelection(original.plan,selected))fail();
     await authority.assertCurrent(tx,actor);
     // Return correlation only: no source refresh, new preview, window renewal,
     // review, claim or execution authority is created by replaying a save.
     return {actionId:id,historical:true as const,authority:'proposal_reference_only' as const};
    }
    const prepared=await prepareGrowthPlatformPlan(tx,selected,await tx.now());
    const state=createPlatformAction(prepared.plan,actor,await tx.now());
    if(!authority.assertEffectCurrent)fail();
    await authority.assertEffectCurrent!(tx,state.plan.effects[0]);
    await tx.insert(id,state);await authority.assertCurrent(tx,actor);await timely(tx,state);await tx.event({actionId:id,kind:'proposed',state});
    return {actionId:id,preview:prepared.preview,historical:false as const,authority:'proposal_reference_only' as const};
   });
  },
  async propose(plan:PlatformPlan,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal),id='platform_action_'+randomUUID();
   return repo.transaction(async tx=>{await tx.lock(id);await authority.assertCurrent(tx,actor);const state=createPlatformAction(plan,actor,await tx.now());
    await tx.insert(id,state);await authority.assertCurrent(tx,actor);await timely(tx,state);await tx.event({actionId:id,kind:'proposed',state});return id});
  },
  async review(id:string,version:number,planDigest:string,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal);
   await locked(id,async(tx,state)=>{if(state.version!==version)fail();await actors(tx,state);await authority.assertCurrent(tx,actor);
    for(const effect of state.plan.effects)if(effect.kind.startsWith('growth.')||effect.kind==='template.object.put'||effect.kind==='template.access.grant'||effect.kind==='deployment.vercel'&&effect.target.leadId){const check=authority.assertEffectCurrent??fail();await check.call(authority,tx,effect)}
    const next=approvePlatformAction(state,{...actor,planDigest},await timely(tx,state));await tx.replace(id,version,next);
    await actors(tx,next);await timely(tx,next);await tx.event({actionId:id,kind:'approved',state:next});});
  },
  async claim(id:string,version:number,principal:PlatformPrincipal){
   const actor=platformPrincipalSchema.parse(principal);
   await locked(id,async(tx,state)=>{if(state.version!==version)fail();await actors(tx,state);
    const next=claimPlatformAction(state,actor,await timely(tx,state));await tx.replace(id,version,next);
    await actors(tx,next);await timely(tx,next);await tx.event({actionId:id,kind:'claimed',state:next});});
  },
  async claimNextEffect(id:string,principal:PlatformPrincipal):Promise<{effect:PlatformEffect;proof:object}>{
   const actor=platformPrincipalSchema.parse(principal);
   const result=await locked(id,async(tx,state)=>{
    if(state.status!=='claimed'||actor.userId!==state.requester.userId||actor.sessionId!==state.requester.sessionId)fail();
    await actors(tx,state);await timely(tx,state);
    let index=-1;
    for(let i=0;i<state.plan.effects.length;i++){
     const status=await tx.readEffect(id,i);
     if(status==='confirmed')continue;
     if(status!==null)fail();index=i;break;
    }
    if(index<0)fail();await tx.writeEffect(id,index,null,'claimed');
    await actors(tx,state);await timely(tx,state);await tx.event({actionId:id,kind:'effect.claimed',state,effectIndex:index});
    return {index,effect:state.plan.effects[index]};
   });
   // No capability is issued unless the transaction's commit is confirmed.
   const proof=Object.freeze({});observations.set(proof,{actionId:id,index:result.index,sendUsed:false,sendGranted:false});return Object.freeze({effect:result.effect,proof});
  },
  async beforeEffectSend(proof:object,rawEffect:PlatformEffect,principal:PlatformPrincipal){
   const binding=observations.get(proof)??fail();
   if(binding.sendUsed)fail();binding.sendUsed=true;
   const actor=platformPrincipalSchema.parse(principal),effect=platformEffectSchema.parse(rawEffect);
   await locked(binding.actionId,async(tx,state)=>{
    if(state.status!=='claimed'||actor.userId!==state.requester.userId||actor.sessionId!==state.requester.sessionId||await tx.readEffect(binding.actionId,binding.index)!=='claimed'||sha256ContentHash(effect)!==sha256ContentHash(state.plan.effects[binding.index]))fail();
    await actors(tx,state);if((effect.kind.startsWith('growth.')||effect.kind==='template.object.put'||effect.kind==='template.access.grant'||effect.kind==='deployment.vercel'&&effect.target.leadId)&&!authority.assertEffectCurrent)fail();await authority.assertEffectCurrent?.(tx,effect);await timely(tx,state);
    // Repeat after awaited authority/clock reads. Final transport calls this
    // after preparation and directly before its one outbound attempt.
    await actors(tx,state);await authority.assertEffectCurrent?.(tx,effect);await timely(tx,state);
    if(effect.kind==='growth.post.publish'||effect.kind==='growth.post.delete'){
     const reserve=(effect.kind==='growth.post.publish'?tx.reservePublication:tx.reservePostDeletion)??fail();await reserve.call(tx,binding.actionId,binding.index,effect.kind==='growth.post.publish'?effect.target.draftId:effect.target.postUrn);
     // Uniqueness can wait on another transaction; authority and expiry must
     // still hold after that wait before committing any send reservation.
     await actors(tx,state);await authority.assertEffectCurrent?.(tx,effect);await timely(tx,state);
    }
   });
   if(observations.get(proof)!==binding)fail();
   binding.sendGranted=true;
  },
  async observeEffect(proof:object,outcome:'confirmed'|'refused'|'unknown'){
   if(!proof||typeof proof!=='object'||!['confirmed','refused','unknown'].includes(outcome))fail();
   const binding=observations.get(proof)??fail();observations.delete(proof);
   if(outcome==='confirmed'&&!binding.sendGranted)fail();
   await locked(binding.actionId,async(tx,state)=>{
    if(state.status!=='claimed'||await tx.readEffect(binding.actionId,binding.index)!=='claimed')fail();
    await tx.writeEffect(binding.actionId,binding.index,'claimed',outcome);
    let final:'confirmed'|'refused'|'unknown'|null=outcome==='confirmed'?null:outcome;
    if(outcome==='confirmed'){
     let all=true;for(let i=0;i<state.plan.effects.length;i++)if(await tx.readEffect(binding.actionId,i)!=='confirmed')all=false;
     if(all)final='confirmed';
    }
    const next=final?finishPlatformAction(state,final,await tx.now()):state;
    if(final)await tx.replace(binding.actionId,state.version,next);
    await tx.event({actionId:binding.actionId,kind:'effect.observed',state:next,effectIndex:binding.index,outcome});
   });
  },
 };
}
