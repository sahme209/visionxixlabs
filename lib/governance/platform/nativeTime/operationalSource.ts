import 'server-only';
import type {ExecutionTimeSource} from '../executionTime';
/** Private C initializer output. This interface is not a qualifier; only the
 * fixed installed initializer can implement the native identity checks. Tests
 * intercept that boundary explicitly. No production addon/default is loaded. */
export interface OperationalNativeContext {
 readonly profileDigest:string;readonly revision:number;readonly hostGeneration:string;
 readonly sourceGeneration:string;readonly source:'amazon-ipv4-ntp';
}
export interface NativeOperationalSample {
 readonly context:object;readonly unixTimeNs:bigint;readonly monotonicBeforeNs:bigint;readonly monotonicAfterNs:bigint;
 readonly publication:bigint;readonly disruptionMarker:bigint;
}
export interface OperationalNativeBridge {
 readonly context:OperationalNativeContext;
 observe(signal:AbortSignal):Promise<NativeOperationalSample>;
 /** C type-tag/owner identity, same original revision/held publication and
  * current administrative CHECK after the native read; never a JSON predicate. */
 assertObservationCurrent(sample:NativeOperationalSample,signal:AbortSignal):Promise<void>;
 retire():void;
}
export interface OperationalTimeObservation {
 readonly assurance:'aws-linux-operational-v1';readonly unixTimeNs:bigint;
 readonly monotonicBeforeNs:bigint;readonly monotonicAfterNs:bigint;
 readonly profileDigest:string;readonly revision:number;readonly hostGeneration:string;readonly sourceGeneration:string;
 readonly publication:bigint;readonly disruptionMarker:bigint;
}
const observations=new WeakMap<object,{value:Readonly<OperationalTimeObservation>;active():boolean}>();
const consumed=new WeakSet<object>();
const MAX=(BigInt(1)<<BigInt(63))-BigInt(1),U64=(BigInt(1)<<BigInt(64))-BigInt(1);
const fail=():never=>{throw Error('operational_time_unavailable')};
const natural=(n:unknown,max=MAX):bigint=>{if(typeof n!=='bigint'||n<BigInt(0)||n>max)return fail();return n};
/** Registry membership attests only original issuance by the injected private
 * native bridge. Real host/profile qualification remains a deployment gate. */
export function readOperationalTimeObservation(value:unknown):Readonly<OperationalTimeObservation>|undefined{
 if(value===null||typeof value!=='object')return undefined;const entry=observations.get(value);return entry&&entry.active()?entry.value:undefined;
}
export function consumeOperationalTimeObservation(value:unknown):Readonly<OperationalTimeObservation>{
 const observation=readOperationalTimeObservation(value);if(!observation||consumed.has(observation))return fail();consumed.add(observation);return observation;
}
export function createOperationalExecutionTimeSource(native:OperationalNativeBridge):ExecutionTimeSource{
 const context=native.context,observe=native.observe.bind(native),current=native.assertObservationCurrent.bind(native),retire=native.retire.bind(native);
 const expected=Object.freeze({profileDigest:context.profileDigest,revision:context.revision,hostGeneration:context.hostGeneration,sourceGeneration:context.sourceGeneration,source:context.source});
 if(!/^[a-f0-9]{64}$/.test(expected.profileDigest)||!Number.isSafeInteger(expected.revision)||expected.revision<1||expected.source!=='amazon-ipv4-ntp'||![expected.hostGeneration,expected.sourceGeneration].every(s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s)))return fail();
 let retired=false,busy=false,lastTime:bigint|undefined,lastMono:bigint|undefined,lastPublication:bigint|undefined,lastMarker:bigint|undefined;
 function same(){if(native.context!==context||Object.keys(expected).some(k=>context[k as keyof OperationalNativeContext]!==expected[k as keyof OperationalNativeContext]))return fail()}
 return async signal=>{
  if(retired||busy)return fail();signal.throwIfAborted();busy=true;
  try{
   same();const supplied=await observe(signal);signal.throwIfAborted();same();
   const sample=Object.freeze({context:supplied.context,unixTimeNs:natural(supplied.unixTimeNs),monotonicBeforeNs:natural(supplied.monotonicBeforeNs),monotonicAfterNs:natural(supplied.monotonicAfterNs),publication:natural(supplied.publication,U64),disruptionMarker:natural(supplied.disruptionMarker,U64)});
   if(sample.context!==context||!sample.publication||sample.monotonicBeforeNs>sample.monotonicAfterNs||lastTime!==undefined&&sample.unixTimeNs<lastTime||lastMono!==undefined&&sample.monotonicBeforeNs<lastMono||lastPublication!==undefined&&sample.publication<lastPublication||lastMarker!==undefined&&sample.disruptionMarker!==lastMarker)return fail();
   // The native operation resolves ONLY its authentic original sample object.
   await current(supplied,signal);signal.throwIfAborted();same();
   if(Object.keys(sample).some(k=>supplied[k as keyof NativeOperationalSample]!==sample[k as keyof NativeOperationalSample]))return fail();
   lastTime=sample.unixTimeNs;lastMono=sample.monotonicAfterNs;lastPublication=sample.publication;lastMarker=sample.disruptionMarker;
   const value=Object.freeze({assurance:'aws-linux-operational-v1' as const,...expected,unixTimeNs:sample.unixTimeNs,monotonicBeforeNs:sample.monotonicBeforeNs,monotonicAfterNs:sample.monotonicAfterNs,publication:sample.publication,disruptionMarker:sample.disruptionMarker});
   observations.set(value,{value,active(){if(retired)return false;try{same();return true}catch{return false}}});return value;
  }catch{if(!retired){retired=true;try{retire()}catch{/* Unknown native cleanup remains retired. */}}return fail()}finally{busy=false}
 };
}
