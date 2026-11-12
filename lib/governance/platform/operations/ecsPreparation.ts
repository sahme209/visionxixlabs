import {readOperationalDelegation} from './delegationContract';
import {compileOperationalEcsPlan} from './ecsPlan';
export {compileOperationalEcsPlan} from './ecsPlan';
import {operationalWorkloadBinding} from './workloadIdentity';
import 'server-only';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import type {PlatformTransaction,PlatformAuthority} from '../actionStore';
import {preparationActionReference} from '../preparationReference';
import {createPlatformAction,readPlatformAction,approvePlatformAction} from '../kernel';
import {operationalEcsManifest} from './contracts';
import {compileOperationalManifest,readOperationalManifest,type OperationalManifest} from './kernel';
export type EcsManifest=Extract<OperationalManifest,{kind:'deployment.ecs'}>;
export type EcsPreparationTransaction=PlatformTransaction&{readEcsManifest(actionId:string):Promise<unknown>;readDelegation(actionId:string):Promise<unknown|null>};
export interface EcsPreparationRepository{transaction<T>(fn:(tx:EcsPreparationTransaction)=>Promise<T>):Promise<T>}
export interface EcsPreparationSource{assertCurrent(tx:EcsPreparationTransaction,manifest:EcsManifest):Promise<void>}
const fail=():never=>{throw Error('ecs_preparation_unavailable')};
export function createEcsPreparationStore(repo:EcsPreparationRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:EcsPreparationSource){
 const current=(tx:EcsPreparationTransaction,principal:PlatformPrincipal)=>authority.assertCurrent(tx,principal);
 async function saved(tx:EcsPreparationTransaction,id:string,actor:PlatformPrincipal){
  await current(tx,actor);const parent=readPlatformAction(await tx.read(id)),manifest=readOperationalManifest(await tx.readEcsManifest(id));
  if(manifest.kind!=='deployment.ecs'||compileOperationalEcsPlan(manifest).digest!==parent.plan.digest)return fail();return {parent,manifest};
 }
 async function qualify(tx:EcsPreparationTransaction,parent:ReturnType<typeof readPlatformAction>,manifest:EcsManifest,actor:PlatformPrincipal){
  await current(tx,parent.requester);await current(tx,actor);await source.assertCurrent(tx,manifest);await current(tx,parent.requester);await current(tx,actor);
  const now=await tx.now();if(!Number.isSafeInteger(now)||now<parent.updatedAt||now>=Date.parse(parent.plan.expiresAt))return fail();return now;
 }
 return Object.freeze({async preview(rawId:string,rawActor:PlatformPrincipal){
  try{const id=operationalWorkloadBinding.shape.actionId.parse(rawId),actor=platformPrincipalSchema.parse(rawActor);return await repo.transaction(async tx=>{
   await tx.lock(id);const {parent,manifest}=await saved(tx,id,actor);if(!['proposed','approved'].includes(parent.status))return fail();const rawDelegation=await tx.readDelegation(id);let delegationState:'not_delegated'|'delegated'='not_delegated';
   if(rawDelegation!==null){const delegation=readOperationalDelegation(rawDelegation);if(parent.status!=='approved'||delegation.status!=='delegated'||delegation.parentPlanDigest!==parent.plan.digest||delegation.manifest.digest!==manifest.digest||delegation.requester.userId!==parent.requester.userId||delegation.requester.sessionId!==parent.requester.sessionId||delegation.reviewer.userId!==parent.reviewer?.userId||delegation.reviewer.sessionId!==parent.reviewer?.sessionId)return fail();delegationState='delegated'}
   await qualify(tx,parent,manifest,actor);await qualify(tx,parent,manifest,actor);
   return Object.freeze({actionId:id,delegationState,planDigest:parent.plan.digest,version:parent.version,status:parent.status,requesterUserId:parent.requester.userId,reviewerUserId:parent.reviewer?.userId??null,manifest,authority:'review_preview_only',executionAuthorized:false});
  })}catch{return fail()}
 },async review(rawId:string,version:number,planDigest:string,rawActor:PlatformPrincipal){
  try{const id=operationalWorkloadBinding.shape.actionId.parse(rawId),actor=platformPrincipalSchema.parse(rawActor);return await repo.transaction(async tx=>{
   await tx.lock(id);const {parent,manifest}=await saved(tx,id,actor);if(parent.status!=='proposed'||parent.version!==version||parent.plan.digest!==planDigest||parent.requester.userId===actor.userId)return fail();
   const next=approvePlatformAction(parent,{...actor,planDigest},await qualify(tx,parent,manifest,actor));await tx.replace(id,version,next);await tx.event({actionId:id,kind:'approved',state:next});await qualify(tx,next,manifest,actor);
   return Object.freeze({actionId:id,planDigest:next.plan.digest,status:next.status,version:next.version,authority:'review_recorded_only',executionAuthorized:false});
  })}catch{return fail()}
 },async prepare(raw:unknown,requestId:string,rawActor:PlatformPrincipal){
  try{const manifest=compileOperationalManifest(operationalEcsManifest.parse(raw));if(manifest.kind!=='deployment.ecs')return fail();const actor=platformPrincipalSchema.parse(rawActor),id=preparationActionReference(requestId,actor,'platform_ecs_preparation_v1'),plan=compileOperationalEcsPlan(manifest);
   return await repo.transaction(async tx=>{
    await tx.lock(id);await current(tx,actor);const existing=await tx.read(id);
    if(existing){const parent=readPlatformAction(existing),saved=readOperationalManifest(await tx.readEcsManifest(id));if(saved.kind!=='deployment.ecs'||parent.requester.userId!==actor.userId||parent.requester.sessionId!==actor.sessionId||parent.plan.digest!==plan.digest||saved.digest!==manifest.digest)return fail();await current(tx,actor);return Object.freeze({actionId:id,historical:true,authority:'proposal_reference_only',executionAuthorized:false})}
    await source.assertCurrent(tx,manifest);await current(tx,actor);const now=await tx.now();if(!Number.isSafeInteger(now)||now>=Date.parse(manifest.expiresAt))return fail();const parent=createPlatformAction(plan,actor,now);
    await tx.insert(id,parent);await tx.event({actionId:id,kind:'proposed',state:parent,ecsManifest:manifest});await source.assertCurrent(tx,manifest);await current(tx,actor);const after=await tx.now();if(!Number.isSafeInteger(after)||after<now||after>=Date.parse(manifest.expiresAt))return fail();return Object.freeze({actionId:id,historical:false,authority:'proposal_reference_only',executionAuthorized:false});
   });
  }catch{return fail()}
 },async lookup(requestId:string,rawActor:PlatformPrincipal){
  try{const actor=platformPrincipalSchema.parse(rawActor),id=preparationActionReference(requestId,actor,'platform_ecs_preparation_v1');return await repo.transaction(async tx=>{
   await tx.lock(id);await current(tx,actor);const raw=await tx.read(id);if(raw){const parent=readPlatformAction(raw),manifest=readOperationalManifest(await tx.readEcsManifest(id));if(manifest.kind!=='deployment.ecs'||parent.requester.userId!==actor.userId||parent.requester.sessionId!==actor.sessionId||compileOperationalEcsPlan(manifest).digest!==parent.plan.digest)return fail()}
   await current(tx,actor);return Object.freeze({found:raw!==null,actionId:id,authority:'history_only',executionAuthorized:false});
  })}catch{return fail()}
 }});
}
