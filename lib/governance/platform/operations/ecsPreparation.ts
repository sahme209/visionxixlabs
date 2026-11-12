import 'server-only';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import type {PlatformTransaction,PlatformAuthority} from '../actionStore';
import {preparationActionReference} from '../preparationReference';
import {compilePlatformPlan,createPlatformAction,readPlatformAction} from '../kernel';
import {operationalEcsManifest} from './contracts';
import {compileOperationalManifest,readOperationalManifest,type OperationalManifest} from './kernel';
export type EcsManifest=Extract<OperationalManifest,{kind:'deployment.ecs'}>;
export type EcsPreparationTransaction=PlatformTransaction&{readEcsManifest(actionId:string):Promise<unknown>};
export interface EcsPreparationRepository{transaction<T>(fn:(tx:EcsPreparationTransaction)=>Promise<T>):Promise<T>}
export interface EcsPreparationSource{assertCurrent(tx:EcsPreparationTransaction,manifest:EcsManifest):Promise<void>}
const fail=():never=>{throw Error('ecs_preparation_unavailable')};
/** Metadata compilation does not qualify account/run/source, image immutability,
 * native state or rollback condition. Those require a private current supplier. */
export function compileOperationalEcsPlan(manifest:EcsManifest){
 const m=readOperationalManifest(manifest);if(m.kind!=='deployment.ecs')return fail();
 return compilePlatformPlan({format:1,scope:'platform',sourceDigest:m.digest,expiresAt:m.expiresAt,effects:[{id:'ecs',kind:'deployment.ecs',target:{accountId:m.target.accountId,region:m.target.region,cluster:m.target.clusterArn,service:m.target.serviceArn,taskDefinitionArn:m.target.taskDefinitionArn,operation:m.operation,configurationDigest:m.digest}}]});
}
export function createEcsPreparationStore(repo:EcsPreparationRepository,authority:Pick<PlatformAuthority,'assertCurrent'>,source:EcsPreparationSource){
 const current=(tx:EcsPreparationTransaction,principal:PlatformPrincipal)=>authority.assertCurrent(tx,principal);
 return Object.freeze({async prepare(raw:unknown,requestId:string,rawActor:PlatformPrincipal){
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
