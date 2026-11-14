import 'server-only';
import type {ExecutionTimeSource} from '../executionTime';
import {decodeTimePublication} from './record';
import {encloseTimePublication,type NativeTimeSample,type TimePremises} from './interval';
/** These handles originate only in the protected native initializer. Structural
 * matching is not qualification. No native profile issuer/launcher is installed. */
export interface NativeTimeHeldSource{readonly identity:object;readonly sourceGeneration:string;readonly disruptionMarker:bigint}
export interface NativeTimeCapture{bytes:Uint8Array;sample:NativeTimeSample;identity:object;sourceGeneration:string;disruptionMarker:bigint}
export interface NativeTimeWorker{readonly result:Promise<NativeTimeCapture>;readonly completed:Promise<void>;terminate():Promise<void>}
export interface NativeTimeSourcePorts{
 /** Acquires the original parent-owned directory/source hold. A late result
  * remains owned and must be released, never used to start a late worker. */
 hold(signal:AbortSignal):Promise<NativeTimeHeldSource>;
 /** Retire the parent hold and quiesce its owned native operations before
  * closing it. Unknown completion permanently retires this source. */
 release(held:NativeTimeHeldSource):Promise<void>;
 /** Actual original producer generation, file/path and disruption currentness;
  * not a JSON boolean or replacement source lookup. */
 assertCurrent(held:NativeTimeHeldSource,signal:AbortSignal):Promise<void>;
 /** Synchronous ownership transfer: an asynchronous launcher could create an
  * unowned worker after timeout. No default native launcher is provided. */
 start(held:NativeTimeHeldSource,limits:Readonly<{maxBytes:4096;deadlineMs:500;cleanupMs:100}>,signal:AbortSignal):NativeTimeWorker;
 /** Final actual lifecycle/path/disruption check AND fresh native P2 after
  * IPC/worker cleanup, retaining original R/P0/P1. Only bounded parent-hold
  * release follows; it can delay return and does not move the P2 observation.
  * It describes P2, never an arbitrary later return/commit instant. Premises must
  * be established by the protected profile, never supplied by a request. */
 observeCurrent(held:NativeTimeHeldSource,capture:Readonly<NativeTimeCapture>,signal:AbortSignal):Promise<Readonly<{sample:NativeTimeSample;premises:TimePremises}>>;
}
const limits=Object.freeze({maxBytes:4096,deadlineMs:500,cleanupMs:100}as const);
const fail=():never=>{throw Error('native_execution_time_unavailable')};
const range=(v:NativeTimeSample['p0'])=>Object.freeze({low:v.low,high:v.high});
const sampleCopy=(v:NativeTimeSample):NativeTimeSample=>Object.freeze({realtimeNs:v.realtimeNs,p0:range(v.p0),p1:range(v.p1),p2:range(v.p2)});
/** Bounded one-shot supervisor, not native qualification. Every call captures
 * anew; concurrency refuses rather than spawning an unbounded worker fleet. */
export function createNativeExecutionTimeSource(ports:NativeTimeSourcePorts):ExecutionTimeSource{
 const hold=ports.hold.bind(ports),release=ports.release.bind(ports),current=ports.assertCurrent.bind(ports),start=ports.start.bind(ports),observe=ports.observeCurrent.bind(ports);let busy=false,retired=false;
 return async originalSignal=>{
  if(busy||retired)return fail();originalSignal.throwIfAborted();busy=true;
  const controller=new AbortController(),signal=AbortSignal.any([originalSignal,controller.signal]);
  let releaseHeld:Promise<void>|undefined,allowRelease!:()=>void;
  const releaseGate=new Promise<void>(resolve=>{allowRelease=resolve});
  type Result=Readonly<{ok:true;value:NativeTimeCapture}|{ok:false}>;
  type OwnedWorker=Readonly<{result:Promise<Result>;completed:Promise<boolean>;terminate:()=>Promise<void>}>;
  let active=true,worker:OwnedWorker|undefined,cleanup:Promise<void>|undefined,abortListener:(()=>void)|undefined;
  const check=()=>{if(!active)return fail();signal.throwIfAborted()};
  const stopped=new Promise<never>((_resolve,reject)=>{abortListener=()=>reject(Error('native_execution_time_unavailable'));signal.addEventListener('abort',abortListener,{once:true})});
  const deadline=setTimeout(()=>controller.abort(),limits.deadlineMs);
  function clean(){if(!worker)return Promise.resolve();if(cleanup)return cleanup;const owned=worker;cleanup=(async()=>{let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([Promise.all([Promise.resolve().then(()=>owned.terminate()),owned.completed.then(ok=>{if(!ok)return fail()})]),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('native_execution_time_unavailable')),limits.cleanupMs)})])}finally{if(timer)clearTimeout(timer)}})();return cleanup}
  try{
   const operation=(async()=>{
    check();const acquisition=Promise.resolve(hold(signal));
    releaseHeld=acquisition.then(async held=>{await releaseGate;await release(held)},()=>undefined);
    const held=await acquisition;check();const identity=held.identity,generation=held.sourceGeneration,marker=held.disruptionMarker;
    if(!identity||typeof identity!=='object'||!/^[-A-Za-z0-9_]{1,128}$/.test(generation)||typeof marker!=='bigint'||marker<BigInt("0")||marker>BigInt("0xffffffffffffffff"))return fail();
    const same=()=>{check();if(held.identity!==identity||held.sourceGeneration!==generation||held.disruptionMarker!==marker)return fail()};
    await current(held,signal);same();const supplied=start(held,limits,signal);
    // Own both rejection channels immediately; resolving tagged outcomes keeps
    // an early failure observed even before result/cleanup is awaited.
    const result=Promise.resolve(supplied.result).then<Result,Result>(value=>({ok:true,value}),()=>({ok:false})),completed=Promise.resolve(supplied.completed).then(()=>true,()=>false),terminate=supplied.terminate.bind(supplied);
    worker=Object.freeze({result,completed,terminate});same();
    const outcome=await Promise.race([worker.result,worker.completed.then(ok=>ok?new Promise<never>(()=>{}):({ok:false}as const))]);same();if(!outcome.ok)return fail();const raw=outcome.value;if(!(raw.bytes instanceof Uint8Array)||raw.bytes.byteLength>limits.maxBytes||raw.identity!==identity||raw.sourceGeneration!==generation||raw.disruptionMarker!==marker)return fail();
    const originalBytes=new Uint8Array(raw.bytes),bytes=new Uint8Array(originalBytes),snapshot=sampleCopy(raw.sample),capture=Object.freeze({bytes,sample:snapshot,identity,sourceGeneration:generation,disruptionMarker:marker});
    const publication=decodeTimePublication(bytes);if(publication.sourceGeneration!==generation||publication.disruptionMarker!==marker)return fail();
    await clean();same();await current(held,signal);same();
    const final=await observe(held,capture,signal);same();const sample=sampleCopy(final.sample);
    if(sample.realtimeNs!==snapshot.realtimeNs||sample.p0.low!==snapshot.p0.low||sample.p0.high!==snapshot.p0.high||sample.p1.low!==snapshot.p1.low||sample.p1.high!==snapshot.p1.high||sample.p2.low<snapshot.p2.low||sample.p2.high<snapshot.p2.high)return fail();
    const p=final.premises,premises=Object.freeze({asOf:range(p.asOf),voidAfter:range(p.voidAfter),maxAgeNs:p.maxAgeNs,lambdaMin:Object.freeze({...p.lambdaMin}),lambdaMax:Object.freeze({...p.lambdaMax})});
    if(bytes.byteLength!==originalBytes.byteLength||bytes.some((value,index)=>value!==originalBytes[index]))return fail();
    return encloseTimePublication(publication,sample,premises);
   })();
   return await Promise.race([operation,stopped]);
  }catch{return fail()}finally{
   active=false;controller.abort();allowRelease();clearTimeout(deadline);if(abortListener)signal.removeEventListener('abort',abortListener);
   let cleanupTimer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([Promise.all([clean(),releaseHeld??Promise.resolve()]),new Promise<never>((_resolve,reject)=>{cleanupTimer=setTimeout(()=>reject(Error('native_execution_time_unavailable')),limits.cleanupMs)})])}catch{retired=true;busy=false;return fail()}finally{if(cleanupTimer)clearTimeout(cleanupTimer)}busy=false;
  }
 };
}
