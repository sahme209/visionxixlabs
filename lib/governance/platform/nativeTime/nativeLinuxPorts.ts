import 'server-only';
import {decodeTimePublication} from './record';
import type {NativeTimeHeldSource,NativeTimeSourcePorts} from './source';

type Limits=Readonly<{maxBytes:4096;deadlineMs:500;cleanupMs:100}>;
export interface RawNativeLinuxHeld {
 readonly bytes:Uint8Array;readonly sourceGeneration:string;readonly device:bigint;readonly inode:bigint;
 readonly publication:bigint;readonly disruptionMarker:bigint;
}
export interface NativeLinuxRawCapture extends RawNativeLinuxHeld {
 readonly identity:object;readonly realtimeNs:bigint;readonly p0Ns:bigint;readonly p1Ns:bigint;readonly p2Ns:bigint;
}
export interface RawNativeLinuxWorker {readonly result:Promise<NativeLinuxRawCapture>;readonly completed:Promise<void>;terminate():Promise<void>}
/** Private native resource API only. These values do not establish time authority.
 * The native initializer, never request JSON, owns the real implementation. */
export interface RawNativeLinuxBridge {
 hold(signal:AbortSignal):Promise<RawNativeLinuxHeld>;
 release(held:RawNativeLinuxHeld):Promise<void>;
 assertResourceCurrent(held:RawNativeLinuxHeld,signal:AbortSignal):Promise<void>;
 start(held:RawNativeLinuxHeld,limits:Limits,signal:AbortSignal):RawNativeLinuxWorker;
 observeResourceCurrent(held:RawNativeLinuxHeld,capture:NativeLinuxRawCapture,signal:AbortSignal):Promise<Readonly<{p2:bigint}>>;
 retire():void;
}
const fail=():never=>{throw Error('native_linux_transport_unavailable')};
const U64=BigInt('18446744073709551615'),I63=BigInt('9223372036854775807'),ZERO=BigInt('0');
const integer=(value:unknown,max=U64):bigint=>{if(typeof value!=='bigint'||value<ZERO||value>max)return fail();return value};
const equalBytes=(a:Uint8Array,b:Uint8Array)=>a.byteLength===b.byteLength&&a.every((value,index)=>value===b[index]);
function metadata(raw:RawNativeLinuxHeld){
 if(!raw||typeof raw!=='object'||!(raw.bytes instanceof Uint8Array)||!raw.bytes.byteLength||raw.bytes.byteLength>4096)return fail();
 const bytes=new Uint8Array(raw.bytes),sourceGeneration=raw.sourceGeneration,device=integer(raw.device),inode=integer(raw.inode),publication=integer(raw.publication),disruptionMarker=integer(raw.disruptionMarker);
 if(typeof sourceGeneration!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(sourceGeneration)||!publication)return fail();
 const decoded=decodeTimePublication(bytes);
 if(decoded.version!==2||decoded.layout!=='clockbound-precise-origin-v1'||decoded.sourceGeneration!==sourceGeneration||decoded.publication!==publication||decoded.disruptionMarker!==disruptionMarker)return fail();
 return Object.freeze({bytes,sourceGeneration,device,inode,publication,disruptionMarker});
}
type Metadata=ReturnType<typeof metadata>;
function same(raw:RawNativeLinuxHeld,original:Metadata){
 const now=metadata(raw);
 if(now.sourceGeneration!==original.sourceGeneration||now.device!==original.device||now.inode!==original.inode||now.publication!==original.publication||now.disruptionMarker!==original.disruptionMarker||!equalBytes(now.bytes,original.bytes))return fail();
}
/** Thin resource transport, plus explicitly UNAVAILABLE admitted ports. No addon
 * is loaded, profile installed, sampling interval converted or premise minted. */
export function createNativeLinuxPorts(bridge:RawNativeLinuxBridge){
 const acquire=bridge.hold.bind(bridge),close=bridge.release.bind(bridge),resourceCurrent=bridge.assertResourceCurrent.bind(bridge),launch=bridge.start.bind(bridge),observe=bridge.observeResourceCurrent.bind(bridge),nativeRetire=bridge.retire.bind(bridge);
 type WorkerState={completed:boolean;terminated:boolean};
 type State={raw:RawNativeLinuxHeld;original:Metadata;released:boolean;started:boolean;observed:boolean;release?:Promise<void>;worker?:WorkerState};
 type CaptureState={owner:State;raw:NativeLinuxRawCapture;original:NativeLinuxRawCapture;bytes:Uint8Array};
 const holds=new WeakMap<object,State>(),captures=new WeakMap<object,CaptureState>();let retired=false,acquiring=false,active:State|undefined;
 function retire(){if(retired)return;retired=true;try{nativeRetire()}catch{ /* Unknown native retirement never reopens this adapter. */ }}
 function check(signal:AbortSignal){if(retired)return fail();signal.throwIfAborted()}
 function state(held:NativeTimeHeldSource,signal?:AbortSignal){
  const value=holds.get(held);if(!value||value.released||retired)return fail();if(signal)signal.throwIfAborted();same(value.raw,value.original);return value;
 }
 function release(held:NativeTimeHeldSource):Promise<void>{
  const value=holds.get(held);if(!value)return Promise.reject(Error('native_linux_transport_unavailable'));
  if(value.release)return value.release;value.released=true;
  value.release=Promise.resolve().then(()=>close(value.raw)).then(()=>{if(active===value)active=undefined},()=>{retire();return fail()});
  void value.release.catch(()=>{});return value.release;
 }
 async function hold(signal:AbortSignal):Promise<NativeTimeHeldSource>{
  check(signal);if(acquiring||active)return fail();acquiring=true;
  const aborted=()=>retire();signal.addEventListener('abort',aborted,{once:true});let raw:RawNativeLinuxHeld|undefined,owned=false;
  try{
   raw=await acquire(signal);
   // Ownership precedes parsing: an invalid or late native object still closes.
   if(!raw||typeof raw!=='object')return fail();owned=true;
   check(signal);const original=metadata(raw),held=Object.freeze({identity:raw,sourceGeneration:original.sourceGeneration,disruptionMarker:original.disruptionMarker});
   const value:State={raw,original,released:false,started:false,observed:false};holds.set(held,value);active=value;owned=false;return held;
  }catch{
   retire();if(owned&&raw)try{await close(raw)}catch{ /* Native retirement retains uncertain cleanup. */ }
   return fail();
  }finally{acquiring=false;signal.removeEventListener('abort',aborted)}
 }
 async function assertResourceCurrent(held:NativeTimeHeldSource,signal:AbortSignal){
  const value=state(held,signal),aborted=()=>retire();signal.addEventListener('abort',aborted,{once:true});
  try{await resourceCurrent(value.raw,signal);state(held,signal)}catch{retire();return fail()}finally{signal.removeEventListener('abort',aborted)}
 }
 function start(held:NativeTimeHeldSource,limits:Limits,signal:AbortSignal):RawNativeLinuxWorker{
  const value=state(held,signal);if(value.started||limits.maxBytes!==4096||limits.deadlineMs!==500||limits.cleanupMs!==100)return fail();value.started=true;
  const owned:WorkerState={completed:false,terminated:false};value.worker=owned;
  let worker:RawNativeLinuxWorker|undefined,nativeResult:Promise<NativeLinuxRawCapture>|undefined,nativeCompleted:Promise<void>|undefined,terminateNative:(()=>Promise<void>)|undefined,termination:Promise<void>|undefined;
  function terminate(){
   if(!termination){
    const original=terminateNative;
    termination=Promise.resolve().then(()=>{if(!original)return fail();return original()}).then(()=>{owned.terminated=true},()=>{retire();return fail()});
    void termination.catch(()=>{});
   }
   return termination;
  }
  try{worker=launch(value.raw,Object.freeze({maxBytes:4096,deadlineMs:500,cleanupMs:100}),signal)}catch{retire();return fail()}
  // Each available promise is captured ONCE and its rejection is owned BEFORE
  // another getter can throw. Continue collecting available cleanup ownership.
  let malformed=false;
  if(!worker||typeof worker!=='object')malformed=true;
  else{
   try{const original=worker.result;if(!(original instanceof Promise))malformed=true;else{nativeResult=original;void original.catch(()=>{})}}catch{malformed=true}
   try{const original=worker.completed;if(!(original instanceof Promise))malformed=true;else{nativeCompleted=original;void original.catch(()=>{})}}catch{malformed=true}
   try{const original=worker.terminate;if(typeof original!=='function')malformed=true;else terminateNative=original.bind(worker)}catch{malformed=true}
  }
  if(malformed||!nativeResult||!nativeCompleted||!terminateNative){retire();if(terminateNative)void terminate().catch(()=>{});return fail()}
  const aborted=()=>{retire();void terminate().catch(()=>{})};signal.addEventListener('abort',aborted,{once:true});if(signal.aborted)aborted();
  const completed=Promise.resolve(nativeCompleted).then(()=>{owned.completed=true;signal.removeEventListener('abort',aborted)},()=>{signal.removeEventListener('abort',aborted);retire();return fail()});void completed.catch(()=>{});
  const result=Promise.resolve(nativeResult).then(raw=>{
   state(held,signal);same(raw,value.original);
   if(raw.identity!==value.raw)return fail();const realtimeNs=integer(raw.realtimeNs,I63),p0Ns=integer(raw.p0Ns,I63),p1Ns=integer(raw.p1Ns,I63),p2Ns=integer(raw.p2Ns,I63);
   if(p0Ns>p1Ns||p1Ns>p2Ns)return fail();
   const bytes=new Uint8Array(value.original.bytes),capture=Object.freeze({...value.original,bytes,identity:value.raw,realtimeNs,p0Ns,p1Ns,p2Ns});
   captures.set(capture,{owner:value,raw,original:capture,bytes:new Uint8Array(bytes)});return capture;
  }).catch(()=>{retire();void terminate().catch(()=>{});return fail()});void result.catch(()=>{});
  return Object.freeze({result,completed,terminate});
 }
 async function observeResourceCurrent(held:NativeTimeHeldSource,capture:NativeLinuxRawCapture,signal:AbortSignal):Promise<NativeLinuxRawCapture>{
  const value=state(held,signal),record=captures.get(capture);if(!record||record.owner!==value||value.observed||value.worker?.completed!==true||value.worker.terminated!==true)return fail();value.observed=true;
  const unchanged=()=>{state(held,signal);same(record.raw,value.original);if(record.raw.identity!==value.raw||record.raw.realtimeNs!==record.original.realtimeNs||record.raw.p0Ns!==record.original.p0Ns||record.raw.p1Ns!==record.original.p1Ns||record.raw.p2Ns!==record.original.p2Ns||!equalBytes(capture.bytes,record.bytes))return fail()};
  unchanged();const aborted=()=>retire();signal.addEventListener('abort',aborted,{once:true});
  try{const result=await observe(value.raw,record.raw,signal);unchanged();const p2Ns=integer(result.p2,I63);if(p2Ns<capture.p2Ns)return fail();return Object.freeze({...capture,bytes:new Uint8Array(record.bytes),p2Ns})}
  catch{retire();return fail()}finally{signal.removeEventListener('abort',aborted)}
 }
 const transport=Object.freeze({hold,release,assertResourceCurrent,start,observeResourceCurrent,retire});
 const ports:NativeTimeSourcePorts=Object.freeze({hold,release,assertCurrent:async()=>fail(),start:()=>fail(),observeCurrent:async()=>fail()});
 return Object.freeze({transport,ports});
}
