import 'server-only';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformEffectSchema,type PlatformEffect} from './contracts';
interface Service{
 readonly actorUserId?:string;
 claimNextEffect(id:string):Promise<{effect:PlatformEffect;proof:object}>;
 beforeEffectSend(proof:object,effect:PlatformEffect):Promise<void>;
 observeEffect(proof:object,outcome:'confirmed'|'refused'|'unknown'):Promise<void>;
}
interface Binding{service:Service;actionId:string;busy:boolean;closed:boolean}
const bindings=new WeakMap<object,Binding>();
const fail=(code='platform_governance_effect_unavailable'):never=>{throw Error(code)};
/** Private composition only. The real service still enforces the original
 * authenticated requester/claimed parent. Client JSON cannot recreate a binding. */
export function bindPlatformExecution(service:Service,actionId:string):object{
 const binding=Object.freeze({});bindings.set(binding,{service,actionId,busy:false,closed:false});return binding;
}
/** Metadata only; possession is still enforced by the bound real service. */
export function describePlatformExecution(value:unknown){
 if(!value||typeof value!=='object')return fail();const entry=bindings.get(value)??fail();if(entry.busy||entry.closed)fail();
 return {actionId:entry.actionId,actor:entry.service.actorUserId?'user:'+entry.service.actorUserId:'platform-governance'};
}
export async function runPlatformEffect<T>(binding:object,rawEffect:PlatformEffect,prepareAndSend:(beforeSend:()=>Promise<void>)=>Promise<{outcome:'confirmed'|'refused'|'unknown';value:T}>):Promise<T>{
 const entry=bindings.get(binding)??fail();if(entry.busy||entry.closed)fail();entry.busy=true;
 let proof:object|undefined,outcome:'confirmed'|'refused'|'unknown'='unknown',value:T|undefined,completed=false;
 try{
  const expected=platformEffectSchema.parse(rawEffect),claim=await entry.service.claimNextEffect(entry.actionId);proof=claim.proof;
  if(sha256ContentHash(expected)!==sha256ContentHash(claim.effect)){outcome='refused';throw Error('effect_mismatch')}
  let used=false,authorized=false;
  const result=await prepareAndSend(async()=>{
   if(used)fail();used=true;
   await entry.service.beforeEffectSend(claim.proof,expected);authorized=true;
  });
  if(!authorized||!result||!['confirmed','refused','unknown'].includes(result.outcome))fail();
  outcome=result.outcome;value=result.value;completed=true;
 }catch{
  // Never expose provider errors or replay a failed preparation/send.
  entry.closed=true;
 }
 try{
  if(proof)await entry.service.observeEffect(proof,outcome);
 }catch{
  entry.closed=true;fail('platform_governance_outcome_unconfirmed');
 }finally{entry.busy=false}
 if(!completed||outcome!=='confirmed'){entry.closed=true;fail()}
 return value as T;
}
