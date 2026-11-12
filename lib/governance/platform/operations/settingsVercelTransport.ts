import {settingsNativeProfile} from './settingsNativeProfile';
import 'server-only';
import {z} from 'zod';
import {settingsArtifactBindingSchema,type SettingsArtifactBinding} from './settingsArtifact';
interface Ports{
 fetch(url:string,init:RequestInit):Promise<Response>;
 /** Private qualification must establish exact target/source, create-conflict
  * semantics, byte limits and Config/Secret mapping. No qualified default. */
 assertQualified(binding:SettingsArtifactBinding):Promise<void>;
 readCredential(binding:SettingsArtifactBinding):Promise<string>;
}
const unknown=()=>({outcome:'unknown' as const});
const responseSchema=z.object({created:z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),key:z.string(),target:z.array(z.string()).length(1),type:z.string(),gitBranch:z.string().nullable().optional(),customEnvironmentIds:z.array(z.string()).max(0).optional(),visibility:z.enum(['config','secret']).optional()}),failed:z.array(z.unknown()).max(0)});
async function boundedJson(response:Response,signal:AbortSignal){
 if(!response.body)throw Error('unavailable');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{for(;;){signal.throwIfAborted();const next=await reader.read();signal.throwIfAborted();if(next.done)break;size+=next.value.byteLength;if(size>65536)throw Error('unavailable');chunks.push(next.value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
}
/** Exact private create-only transport. It cannot accept arbitrary URLs, update
 * IDs, upsert, environment arrays, branches, raw result callbacks or deploys.
 * A source-qualified profile and final execution callback remain mandatory. */
export function createSettingsVercelTransport(ports:Ports){return Object.freeze({async send(raw:SettingsArtifactBinding,value:string,beforeSend:()=>Promise<void>){
 const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const expired=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('unavailable'))},10000)});
  return await Promise.race([expired,(async()=>{
   const binding=settingsArtifactBindingSchema.parse(raw),native=settingsNativeProfile({type:binding.target.type,sensitivity:binding.target.sensitivity});if(typeof value!=='string'||value.includes('\0')||Buffer.byteLength(value,'utf8')>65536||Buffer.from(value,'utf8').toString('utf8')!==value)return unknown();
   await ports.assertQualified(binding);abort.signal.throwIfAborted();const credential=await ports.readCredential(binding);abort.signal.throwIfAborted();if(typeof credential!=='string'||credential.length<1||credential.length>8192||/[\s\x00-\x1f\x7f]/.test(credential))return unknown();
   await ports.assertQualified(binding);abort.signal.throwIfAborted();
   const url=new URL('https://api.vercel.com/v10/projects/'+encodeURIComponent(binding.target.projectId)+'/env');url.searchParams.set('teamId',binding.target.teamId);
   const body=JSON.stringify({key:binding.target.name,value,type:native.type,visibility:native.visibility,target:[binding.target.environment]});
   await beforeSend();abort.signal.throwIfAborted();
   const response=await ports.fetch(url.href,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body,redirect:'error',cache:'no-store',signal:abort.signal});abort.signal.throwIfAborted();
   if(response.status!==201||response.redirected){void response.body?.cancel().catch(()=>{});return unknown()}
   const parsed=responseSchema.parse(await boundedJson(response,abort.signal)),created=parsed.created;
   if(created.key!==binding.target.name||created.target[0]!==binding.target.environment||created.type!==native.type||created.visibility!==native.visibility||created.gitBranch)return unknown();
   return {outcome:'confirmed' as const,settingId:created.id};
  })()]);
 }catch{return unknown()}finally{if(timer)clearTimeout(timer);abort.abort()}
}})}
