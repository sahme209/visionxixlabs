import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
interface Job{format:1;purpose:'platform_image_candidate_decode_v1';bytes:Uint8Array;mimeType:'image/png'|'image/jpeg';profileDigest:string}
export interface PreparedImageDecoderParentPorts{
 /** Private real supplier must qualify the exact native package/launcher and
  * OS memory/CPU/filesystem/network/ownership bounds. No default is supplied. */
 assertQualified(profileDigest:string,signal:AbortSignal):Promise<void>;
 /** Synchronous owned-handle acquisition; no detached/untracked launch or
  * async launch acknowledgment. Actual launch is separately unqualified. */
 start(job:Job,signal:AbortSignal):{result:Promise<unknown>;stop():Promise<boolean>};
}
const fail=():never=>{throw Error('platform_image_decode_unavailable')};
const candidate=z.object({mimeType:z.enum(['image/png','image/jpeg']),width:z.number().int().min(1).max(4096),height:z.number().int().min(1).max(4096),formatProfileDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict().refine(v=>v.width*v.height<=4194304);
const reply=z.object({ok:z.literal(true),candidate,qualification:z.literal('not_established')}).strict();
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
/** Approved source/mock preparation only. Does NOT launch a process, import a
 * codec, implement OS isolation, issue qualification or register a decoder.
 * A single instance is consumed even on refusal; it cannot retry unknown work. */
export function createPreparedImageDecoderParent(profileDigest:string,ports?:PreparedImageDecoderParentPorts){
 let consumed=false;
 return async(input:Uint8Array,mimeType:'image/png'|'image/jpeg',callerSignal:AbortSignal)=>{
  if(consumed)return fail();consumed=true;
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,cleanupTimer:ReturnType<typeof setTimeout>|undefined,handle:ReturnType<PreparedImageDecoderParentPorts['start']>|undefined,copy:Uint8Array|undefined,value:z.infer<typeof candidate>|undefined,valid=false,closed=false;
  let rejectStop!:(e:Error)=>void;const stopped=new Promise<never>((_,reject)=>{rejectStop=reject});
  const abort=()=>{controller.abort();rejectStop(Error('stopped'))};
  const check=()=>{if(closed||callerSignal.aborted||controller.signal.aborted)throw Error('stopped')};
  try{
   if(!ports||!/^[a-f0-9]{64}$/.test(profileDigest)||!(input instanceof Uint8Array)||input.length<1||input.length>2097152||!['image/png','image/jpeg'].includes(mimeType)||callerSignal.aborted)return fail();
   copy=new Uint8Array(input);const digest=sha(copy);callerSignal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,2000);
   value=await Promise.race([(async()=>{
    await ports.assertQualified(profileDigest,controller.signal);check();
    handle=ports.start({format:1,purpose:'platform_image_candidate_decode_v1',bytes:copy!,mimeType,profileDigest},controller.signal);const response=Promise.resolve(handle.result);void response.catch(()=>{});check();
    const result=reply.parse(await response);check();
    if(result.candidate.mimeType!==mimeType||result.candidate.formatProfileDigest!==profileDigest||sha(copy!)!==digest)throw Error('mismatch');
    await ports.assertQualified(profileDigest,controller.signal);check();return result.candidate;
   })(),stopped]);valid=true;
  }catch{valid=false}
  finally{
   closed=true;clearTimeout(timer);callerSignal.removeEventListener('abort',abort);controller.abort();
   if(handle){try{const stopped=await Promise.race([handle.stop(),new Promise<boolean>(resolve=>{cleanupTimer=setTimeout(()=>resolve(false),1000)})]);if(stopped!==true)valid=false}catch{valid=false}finally{clearTimeout(cleanupTimer)}}
   copy?.fill(0);
  }
  if(!valid||!value||callerSignal.aborted)return fail();return value;
 };
}
