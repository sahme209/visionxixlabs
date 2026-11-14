import 'server-only';
import type {RawNativeLinuxBridge,RawNativeLinuxHeld,NativeLinuxRawCapture,RawNativeLinuxWorker} from './nativeLinuxPorts';
import type {OperationalNativeBridge,OperationalNativeContext,NativeOperationalSample} from './operationalSource';
/** Exact output of axiom_time_operational_create_private. No loader, JSON
 * factory, arbitrary FD/path, public constructor or default is installed here. */
export interface PrivateOperationalInitializer {
 readonly context:OperationalNativeContext;readonly raw:RawNativeLinuxBridge;
 /** Captures the C monotonic whole-invocation deadline before hold. */
 beginObservation():void;
 sampleOriginal(held:RawNativeLinuxHeld,capture:NativeLinuxRawCapture,signal:AbortSignal):Promise<NativeOperationalSample>;
 assertObservationCurrent(sample:NativeOperationalSample,signal:AbortSignal):Promise<void>;
 retire():void;
}
const limits=Object.freeze({maxBytes:4096,deadlineMs:500,cleanupMs:100} as const);
const fail=():never=>{throw Error('operational_native_source_unavailable')};
interface State {
 signal:AbortSignal;stop:AbortController;held?:RawNativeLinuxHeld;acquisition?:Promise<RawNativeLinuxHeld>;
 result?:Promise<{ok:true;value:NativeLinuxRawCapture}|{ok:false}>;completed?:Promise<boolean>;terminate?:()=>Promise<void>;
 termination?:Promise<void>;cleanup?:Promise<void>;sample?:NativeOperationalSample;timer:ReturnType<typeof setTimeout>;
 abort:()=>void;retired:boolean;
}
/** Owns ONLY the original C-issued raw handles. Native sampler validates their
 * C tags/context and pins until final currentness; JS fields never select a FD.
 * 500ms includes acquisition through final check; 100ms cleanup, no retry. */
export function createOperationalNativeBridge(initializer:PrivateOperationalInitializer):OperationalNativeBridge{
 const begin=initializer.beginObservation.bind(initializer),context=initializer.context,raw=initializer.raw,hold=raw.hold.bind(raw),start=raw.start.bind(raw),release=raw.release.bind(raw),resourceCurrent=raw.assertResourceCurrent.bind(raw),sampleOriginal=initializer.sampleOriginal.bind(initializer),nativeCurrent=initializer.assertObservationCurrent.bind(initializer),nativeRetire=initializer.retire.bind(initializer);
 let poisoned=false,active:State|undefined;
 function retire(){if(!poisoned){poisoned=true;try{nativeRetire()}catch{/* Sticky refusal; no native exception escapes. */}}if(active){active.retired=true;active.stop.abort();void cleanup(active).catch(()=>{})}}
 function terminate(s:State){if(!s.termination)s.termination=Promise.resolve().then(()=>s.terminate?.());return s.termination}
 function cleanup(s:State){
  if(s.cleanup)return s.cleanup;
  s.cleanup=(async()=>{
   let failed=false;
   try{if(s.terminate){const outcomes=await Promise.allSettled([terminate(s),s.completed??Promise.resolve(false)]);failed=outcomes.some(o=>o.status==='rejected')||outcomes[1].status!=='fulfilled'||outcomes[1].value!==true}}
   finally{try{
    // Release is a native ownership request, not an unsafe close: the original
    // parent's operation refs quarantine a still-active/unknown child.
    const h=s.held??await s.acquisition;if(h)await release(h);
   }finally{clearTimeout(s.timer);s.signal.removeEventListener('abort',s.abort)}}
   if(failed)return fail();})();void s.cleanup.catch(()=>{});return s.cleanup;
 }
 async function boundedCleanup(s:State){let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([cleanup(s),new Promise<never>((_r,reject)=>{timer=setTimeout(()=>reject(Error('operational_cleanup_unknown')),100)})])}finally{if(timer)clearTimeout(timer)}}
 function check(s:State){if(poisoned||active!==s||s.retired||initializer.context!==context||initializer.raw!==raw)return fail();s.signal.throwIfAborted();s.stop.signal.throwIfAborted()}
 async function within<T>(s:State,fn:()=>Promise<T>):Promise<T>{check(s);const signal=AbortSignal.any([s.signal,s.stop.signal]);let listener:(()=>void)|undefined;try{return await Promise.race([Promise.resolve().then(fn),new Promise<never>((_r,reject)=>{listener=()=>reject(Error('operational_native_cancelled'));signal.addEventListener('abort',listener,{once:true});if(signal.aborted)listener()})])}finally{if(listener)signal.removeEventListener('abort',listener)}}
 return Object.freeze({context,
  async observe(signal:AbortSignal){
   if(poisoned||active)return fail();signal.throwIfAborted();const stop=new AbortController();
   const s:State={signal,stop,timer:setTimeout(()=>{retire()},500),abort:()=>{retire()},retired:false};active=s;signal.addEventListener('abort',s.abort,{once:true});
   try{
    begin();check(s);s.acquisition=Promise.resolve(hold(AbortSignal.any([signal,stop.signal])));void s.acquisition.catch(()=>{});
    s.held=await within(s,()=>s.acquisition!);check(s);await within(s,()=>resourceCurrent(s.held!,signal));
    let worker:RawNativeLinuxWorker|undefined,malformed=false;
    // Getters are read once, each promise immediately rejection-owned before
    // inspecting a later handoff field. Cleanup retains original termination.
    try{worker=start(s.held,limits,AbortSignal.any([signal,stop.signal]));const result=worker.result;s.result=Promise.resolve(result).then(value=>({ok:true as const,value}),()=>({ok:false as const}));if(!result||typeof result.then!=='function')malformed=true}catch{malformed=true}
    try{const complete=worker?.completed;s.completed=Promise.resolve(complete).then(()=>true,()=>false);if(!complete||typeof complete.then!=='function')malformed=true}catch{malformed=true}
    try{const close=worker?.terminate;if(typeof close!=='function')malformed=true;else s.terminate=close.bind(worker)}catch{malformed=true}
    if(malformed||!s.result||!s.completed||!s.terminate)return fail();
    const outcome=await within(s,()=>Promise.race([s.result!,s.completed!.then(ok=>ok?new Promise<never>(()=>{}):({ok:false as const}))]));check(s);if(!outcome.ok)return fail();
    await within(s,async()=>{await Promise.all([terminate(s),s.completed!.then(ok=>{if(!ok)return fail()})])});check(s);
    const value=await within(s,()=>sampleOriginal(s.held!,outcome.value,signal));check(s);s.sample=value;return value;
   }catch{retire();try{await boundedCleanup(s)}catch{/* Unknown stays retired; late ownership remains. */}return fail()}
  },
  async assertObservationCurrent(sample:NativeOperationalSample,signal:AbortSignal){
   const s=active;if(!s)return fail();try{check(s);signal.throwIfAborted();if(s.sample!==sample)return fail();await within(s,()=>nativeCurrent(sample,signal));check(s);signal.throwIfAborted();await boundedCleanup(s);check(s);active=undefined}
   catch{retire();try{await boundedCleanup(s)}catch{/* Retained late cleanup owns original resources. */}return fail()}
  },retire,
 });
}
