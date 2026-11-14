import {encodeTimePublication,decodeTimePublication,type TimePublication,type PreciseTimePublication} from './record';
export interface TimePublisherPorts {
 assertCurrent():void;
 /** Fixed native preparation must return its own opaque stage; no execution or filesystem default exists here. */
 createStage(bytes:Uint8Array,name:string):object;
 finishStage(stage:object):void;
 replaceCurrent(stage:object):void;
 delegate(value:Readonly<TimePublication>):void;
 /** Native implementation must terminate this actual generation, not throw-and-return through ShmWrite. */
 fatal():never;
}
const unavailable=():never=>{throw Error('time_publisher_unavailable')};
/** Synchronous fail-stop protocol with explicitly injected native operations.
 * Mock success does not establish atomic rename, immutability or producer liveness. */
export function createTimePublisher(generation:string,ports:TimePublisherPorts){
 const current=ports.assertCurrent.bind(ports),create=ports.createStage.bind(ports),finish=ports.finishStage.bind(ports),replace=ports.replaceCurrent.bind(ports),delegate=ports.delegate.bind(ports),fatal:()=>unknown=ports.fatal.bind(ports);
 const stages=new WeakSet<object>();
 let failed=false,busy=false,counter=BigInt("0");
 function die():never{
  failed=true;const result=fatal();if(result instanceof Promise)void result.catch(()=>{});return unavailable();
 }
 const active=()=>{if(failed)return unavailable()};
 function sync(fn:()=>unknown){const value=fn();if(value instanceof Promise)void value.catch(()=>{});if(value!==undefined)return unavailable();active()}
 if(typeof generation!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(generation))return die();
 return Object.freeze({publish(raw:Omit<PreciseTimePublication,'version'|'sourceGeneration'|'publication'>):void{
  try{
   if(failed||busy)return unavailable();busy=true;
   if(counter===(BigInt("1")<<BigInt("64"))-BigInt("1"))return unavailable();counter++;
   const bytes=encodeTimePublication({...raw,version:2,sourceGeneration:generation,publication:counter}),snapshot=decodeTimePublication(bytes);active();
   if(counter===BigInt("1")&&snapshot.status!=='unknown')return unavailable();
   sync(current);
   const supplied=bytes.slice(),stage=create(supplied,'axiom_time_'+generation+'_'+counter);active();
   if(stage instanceof Promise)void stage.catch(()=>{});
   if(!stage||typeof stage!=='object'||'then' in stage||stages.has(stage))return unavailable();
   stages.add(stage);
   const unchanged=()=>{if(supplied.byteLength!==bytes.byteLength||supplied.some((byte,index)=>byte!==bytes[index]))return unavailable()};unchanged();
   sync(()=>finish(stage));unchanged();sync(current);
   sync(()=>replace(stage));unchanged();sync(current);
   sync(()=>delegate(snapshot));
  }catch{return die()}finally{busy=false}
 }});
}
