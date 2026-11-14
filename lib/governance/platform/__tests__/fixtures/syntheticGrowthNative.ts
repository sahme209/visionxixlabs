import {createGrowthNativeTransport,type GrowthTiming,type GrowthNativeEffect} from '../../growthNativeTransport';
import {bindPlatformGrowthExecution} from '../../effectExecution';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ExecutionTimeCheck} from '../../executionTime';
/** TEST ONLY. Explicit synthetic custody/profile; never default qualification. */
export function syntheticGrowthNative(timing:GrowthTiming,actionId:string,version:string|((effect:GrowthNativeEffect)=>Promise<string>)){
 const expiry=Date.now()+60000;
 return createGrowthNativeTransport({...timing,actionId,
  async readProfile(effect){return {profileDigest:'a'.repeat(64),actionId,effectDigest:sha256ContentHash(effect),credentialVersion:typeof version==='string'?version:await version(effect),notBefore:0,expiresAt:expiry}},
  async assertDispatchCurrent(){},async assertProfileCurrent(){},fetch:(url,init)=>fetch(url,init),
 });
}
type Service=Parameters<typeof bindPlatformGrowthExecution>[0];
/** Standalone publisher doubles have no real transactional authority. Keep the
 * installed transport/row/decrypt path real while explicitly simulating owners. */
export function syntheticGrowthBinding(service:Service,actionId:string,version:string){
 const signal=new AbortController().signal,timing={clock:async()=>({earliest:Date.now(),latest:Date.now()}),signal,assertActive:()=>signal.throwIfAborted()};
 const check=async(value:ExecutionTimeCheck|undefined)=>{if(!value)throw Error('synthetic native check required');await value()};
 return bindPlatformGrowthExecution({...service,
  async beforeEffectCredential(_proof,_effect,value,finalFacts){await check(value);await finalFacts?.()},
  async assertEffectCredentialCurrent(_proof,_effect,value,finalFacts){await check(value);await finalFacts?.()},
  async beforeEffectSend(proof,effect,value,finalFacts){await service.beforeEffectSend(proof,effect);await check(value);await finalFacts?.()},
 },actionId,syntheticGrowthNative(timing,actionId,version),timing);
}
