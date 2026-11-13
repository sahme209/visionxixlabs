import {assertDeploymentNativeTransport} from './deploymentNativeTransport';
import type {DeploymentNativeTransport,DeploymentTiming} from './deploymentNativeTransport';
import type {ExecutionTimeCheck,ExecutionTimeAuthorization} from './executionTime';
import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformEffectSchema,type PlatformEffect} from './contracts';
interface Service{
 readonly actorUserId?:string;
 claimNextEffect(id:string):Promise<{effect:PlatformEffect;proof:object}>;
 beforeEffectSend(proof:object,effect:PlatformEffect,nativeCheck?:ExecutionTimeCheck):Promise<void>;
 beforeEffectCredential?(proof:object,effect:PlatformEffect,nativeCheck:ExecutionTimeCheck):Promise<void>;
 observeEffect(proof:object,outcome:'confirmed'|'refused'|'unknown',observation?:unknown):Promise<void>;
 beforeEffectResult?(proof:object):Promise<void>;
}
interface Binding{service:Service;actionId:string;busy:boolean;closed:boolean;deployment?:Readonly<DeploymentNativeTransport>}
const bindings=new WeakMap<object,Binding>();
const fail=(code='platform_governance_effect_unavailable'):never=>{throw Error(code)};
/** Private composition only. The real service still enforces the original
 * authenticated requester/claimed parent. Client JSON cannot recreate a binding. */
export function bindPlatformExecution(service:Service,actionId:string):object{
 const binding=Object.freeze({});bindings.set(binding,{service,actionId,busy:false,closed:false});return binding;
}
/** Private runtime attachment, never reconstructible from request JSON. */
export function bindPlatformDeploymentExecution(service:Service,actionId:string,transport:Readonly<DeploymentNativeTransport>,timing:DeploymentTiming):object{
 assertDeploymentNativeTransport(transport);
 if(typeof timing.clock!=='function'||!(timing.signal instanceof AbortSignal)||transport.clock!==timing.clock||transport.signal!==timing.signal||typeof service.beforeEffectCredential!=='function')return fail();
 const binding=bindPlatformExecution(service,actionId);bindings.get(binding)!.deployment=transport;return binding;
}
export function readPlatformDeploymentTransport(binding:object){const entry=bindings.get(binding)??fail();if(entry.busy||entry.closed||!entry.deployment)return fail();entry.deployment.signal.throwIfAborted();return entry.deployment}
/** Metadata only; possession is still enforced by the bound real service. */
export function describePlatformExecution(value:unknown){
 if(!value||typeof value!=='object')return fail();const entry=bindings.get(value)??fail();if(entry.busy||entry.closed)fail();
 return {actionId:entry.actionId,actor:entry.service.actorUserId?'user:'+entry.service.actorUserId:'platform-governance'};
}
export async function runPlatformEffect<T>(binding:object,rawEffect:PlatformEffect,prepareAndSend:(beforeSend:ExecutionTimeAuthorization,beforeCredential:ExecutionTimeAuthorization)=>Promise<{outcome:'confirmed'|'refused'|'unknown';value:T;observation?:unknown}>):Promise<T>{
 const entry=bindings.get(binding)??fail();if(entry.busy||entry.closed)fail();entry.busy=true;
 let proof:object|undefined,outcome:'confirmed'|'refused'|'unknown'='unknown',value:T|undefined,observation:unknown,completed=false,expected:PlatformEffect|undefined;
 try{
  const selectedEffect=platformEffectSchema.parse(rawEffect);expected=selectedEffect;if(selectedEffect.kind.startsWith('template.'))fail();const claim=await entry.service.claimNextEffect(entry.actionId);proof=claim.proof;
  if(sha256ContentHash(selectedEffect)!==sha256ContentHash(claim.effect)){outcome='refused';throw Error('effect_mismatch')}
  let used=false,authorized=false,acquisitionUsed=false;
  const result=await prepareAndSend(async check=>{
   if(used||selectedEffect.kind==='deployment.vercel'&&(!acquisitionUsed||typeof check!=='function'))fail();used=true;
   if(check===undefined)await entry.service.beforeEffectSend(claim.proof,selectedEffect);else await entry.service.beforeEffectSend(claim.proof,selectedEffect,check);authorized=true;
  },async check=>{
   if(acquisitionUsed||used||selectedEffect.kind!=='deployment.vercel'||typeof check!=='function'||!entry.service.beforeEffectCredential)return fail();acquisitionUsed=true;
   await entry.service.beforeEffectCredential(claim.proof,selectedEffect,check);
  });
  if(!authorized||!result||!['confirmed','refused','unknown'].includes(result.outcome))fail();
  outcome=result.outcome;value=result.value;observation=result.observation;completed=true;
 }catch{
  // Never expose provider errors or replay a failed preparation/send.
  entry.closed=true;
 }
 try{
  if(proof){if(observation===undefined)await entry.service.observeEffect(proof,outcome);else await entry.service.observeEffect(proof,outcome,observation)}
 }catch{
  entry.closed=true;fail('platform_governance_outcome_unconfirmed');
 }finally{entry.busy=false}
 if(!completed||outcome!=='confirmed'){entry.closed=true;fail()}
 if(expected?.kind==='deployment.vercel'){try{if(!entry.service.beforeEffectResult||!proof)fail();await entry.service.beforeEffectResult!(proof!)}catch{entry.closed=true;fail('platform_governance_result_unavailable')}}
 return value as T;
}
