import 'server-only';
import {authorizeExecutionWindow,type ExecutionTimeSource,type ExecutionTimeCheck,type ExecutionTimeWindow} from './executionTime';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {readImageUploadBinding,type ImageUploadBinding} from './imageCustodyContract';
import {readImageUploadGrantContext} from './imageCustodyCodec';
import {imageInitializationRequest,readImageInitialization,readImageUploadAddress,readImagePutAcceptance,readImageAvailability} from './imageUploadProtocol';

export interface ImageNativePorts {
 /** Fixed private profile input; the supplier must bind this exact version to
  * the reviewed profile. No environment-selected version or endpoint fallback. */
 version:string;
 clock:ExecutionTimeSource;
 now():number;
 assertQualified(binding:Readonly<ImageUploadBinding>,version:string,signal:AbortSignal):Promise<void>;
 assertObservationAllowed(binding:Readonly<ImageUploadBinding>,signal:AbortSignal):Promise<void>;
 assertCurrent(binding:Readonly<ImageUploadBinding>,index:0|1,signal:AbortSignal,timeCheck?:ExecutionTimeCheck):Promise<void>;
 /** Must acknowledge the durable original parent/child/native reservation
  * commit. A lost acknowledgement grants neither credentials nor a send. */
 admit(binding:Readonly<ImageUploadBinding>,index:0|1,signal:AbortSignal):Promise<void>;
 readCredential(binding:Readonly<ImageUploadBinding>,index:0|1,signal:AbortSignal):Promise<string>;
 assertCredentialCurrent(binding:Readonly<ImageUploadBinding>,credential:string,signal:AbortSignal):Promise<void>;
}
export type ImageNativeObservation =
 | Readonly<{kind:'initialized';image:string;address:string;issuedAt:number;expiresAt:number}>
 | Readonly<{kind:'ready';image:string;owner:string;mediaReady:true;observedAt:number}>;
const fail=():never=>{throw Error('platform_image_native_unavailable');};
const credentialSchema=z.string().min(1).max(8192).regex(/^[\x21-\x7e]+$/);

/** Prepared private real HTTP transport, not mounted or qualified by default.
 * Only this instance can issue/consume its exact once-only observations. The
 * enclosing execution store must persist them atomically with original claims.
 * No client, generic adapter, source hash or caller JSON can create a proof. */
export function createImageNativeTransport(ports?:ImageNativePorts,requestSignal?:AbortSignal){
 const clock=ports?.clock;
 const used=new Set<string>();
 const observations=new WeakMap<object,{bindingDigest:string;index:0|1;value:ImageNativeObservation}>();
 async function perform(raw:unknown,index:0|1,put?:{context:unknown;address:unknown;bytes:unknown}):Promise<object>{
  let bytes:Buffer|undefined,abort:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const b=readImageUploadBinding(raw),slot=b.bindingDigest+':'+index;
   if(!ports||used.has(slot))return fail();used.add(slot);
   const p=ports,version=p.version;
   const initial=imageInitializationRequest(b.artifact.author,version);
   if(b.profile.destinationOrigin!=='https://www.linkedin.com')return fail();
   let grant:ReturnType<typeof readImageUploadGrantContext>|undefined,address:string|undefined;
   if(index===1){
    if(!put)return fail();grant=readImageUploadGrantContext(put.context);
    if(hash(grant.binding)!==hash(b))return fail();
    address=readImageUploadAddress(put.address,grant.native.providerImageReference);
    if(!(put.bytes instanceof Uint8Array)||put.bytes.byteLength!==b.artifact.byteCount)return fail();
    bytes=Buffer.from(put.bytes);
    if(createHash('sha256').update(bytes).digest('hex')!==b.artifact.bytesDigest)return fail();
   }
   abort=new AbortController();
   timer=setTimeout(()=>abort!.abort(),15000);
   const signal=AbortSignal.any([abort.signal,...(requestSignal?[requestSignal]:[])]);
   let credential:string|undefined,lastNow=-1;
   function time(){
    signal.throwIfAborted();const now=p.now();
    if(!Number.isSafeInteger(now)||now<0||now<lastNow||now>=Date.parse(b.expiresAt)||grant&&(now<grant.native.issuedAt||now>=grant.native.expiresAt))return fail();
    lastNow=now;return now;
   }
   async function within<T>(fn:()=>Promise<T>):Promise<T>{signal.throwIfAborted();const result=await withGithubAbort(Promise.resolve().then(()=>{signal.throwIfAborted();return fn()}),signal);signal.throwIfAborted();return result;}
   async function current(extra?:ExecutionTimeWindow){
    time();if(p.version!==version)return fail();
    await within(()=>p.assertQualified(b,version,signal));
    await within(()=>p.assertObservationAllowed(b,signal));
    const window={notBefore:Math.max(grant?.native.issuedAt??0,extra?.notBefore??0),expiresAt:Math.min(Date.parse(b.expiresAt),grant?.native.expiresAt??Number.MAX_SAFE_INTEGER,extra?.expiresAt??Number.MAX_SAFE_INTEGER)};
    await within(()=>authorizeExecutionWindow(clock!,window,check=>{if(!check)return fail();return p.assertCurrent(b,index,signal,async restriction=>{
     await check(restriction);if(credential)await within(()=>p.assertCredentialCurrent(b,credential!,signal));signal.throwIfAborted();if(p.version!==version)return fail();
    })},signal));
    if(p.version!==version)return fail();time();
   }
   await current();await within(()=>p.admit(b,index,signal));await current();
   credential=credentialSchema.parse(await within(()=>p.readCredential(b,index,signal)));
   await current();
   async function send(url:string,init:RequestInit){
    await current();
    // No await between this point-clock/abort guard and fetch. Native
    // interval validity through final authorization/commit/dispatch still
    // requires separate qualification; a timer is not that evidence.
    return within(()=>{time();return fetch(url,{...init,headers:{...initial.headers,authorization:'Bearer '+credential,...(init.headers??{})},redirect:'error',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal})});
   }
   async function json(response:Response){
    const body=await readBoundedGithubBody(response,signal,65536);
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}finally{body.fill(0)}
   }
   let value:ImageNativeObservation;
   if(index===0){
    const response=await send(initial.url,{method:initial.method,body:initial.body});
    if(response.status!==200||response.redirected){void response.body?.cancel().catch(()=>{});return fail()}
    const result=readImageInitialization(response.status,await json(response),time(),Date.parse(b.expiresAt));
    value=Object.freeze({kind:'initialized',...result});
   }else{
    if(!grant||!bytes||!address)return fail();
    const response=await send(address,{method:'PUT',headers:{'Content-Type':b.artifact.mimeType},body:bytes as unknown as BodyInit});
    if(response.status!==201||response.redirected){void response.body?.cancel().catch(()=>{});return fail()}
    // A null body is the documented empty response too. Any nonempty stream
    // or dishonest Content-Length refuses, including chunked overflow.
    let count=0;
    if(response.body){const body=await readBoundedGithubBody(response,signal,0);count=body.byteLength;body.fill(0)}
    else if(response.headers.get('content-length')!==null&&response.headers.get('content-length')!=='0')return fail();
    readImagePutAcceptance(response.status,count);await current();
    const url='https://api.linkedin.com/rest/images/'+encodeURIComponent(grant.native.providerImageReference);
    const observed=await send(url,{method:'GET'});
    if(observed.status!==200||observed.redirected){void observed.body?.cancel().catch(()=>{});return fail()}
    const ready=readImageAvailability(await json(observed),b.artifact.author,grant.native.providerImageReference);
    if(!ready.mediaReady)return fail();
    value=Object.freeze({kind:'ready',image:ready.image,owner:ready.owner,mediaReady:true,observedAt:time()});
   }
   await current(value.kind==='initialized'?{notBefore:value.issuedAt,expiresAt:value.expiresAt}:undefined);const proof=Object.freeze({});observations.set(proof,{bindingDigest:b.bindingDigest,index,value});return proof;
  }catch{return fail()}finally{if(timer)clearTimeout(timer);abort?.abort();bytes?.fill(0)}
 }
 return Object.freeze({
  initialize:(binding:unknown)=>perform(binding,0),
  put:(binding:unknown,context:unknown,address:unknown,bytes:unknown)=>perform(binding,1,{context,address,bytes}),
  consume(proof:object,raw:unknown,index:0|1):ImageNativeObservation{
   const record=observations.get(proof);observations.delete(proof);
   const b=readImageUploadBinding(raw);
   if(!record||record.bindingDigest!==b.bindingDigest||record.index!==index)return fail();return record.value;
  },
 });
}
