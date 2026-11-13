import 'server-only';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {authorizeExecutionWindow,type ExecutionTimeSource,type ExecutionTimeCheck} from './executionTime';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {S3Client,CreateBucketCommand,PutObjectCommand,GetObjectCommand,GetBucketVersioningCommand} from '@aws-sdk/client-s3';
import {STSClient,GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {readPlatformTemplateBytes} from '@/lib/cloud/aws/platformTemplateSource';
import {readBoundedPlatformTemplateBody,validatePlatformTemplateSignedUrl} from '@/lib/cloud/aws/templateHosting';
import {readTemplateExecutionBinding,type TemplateExecutionBinding} from './templateExecutionContract';
const credential=z.object({accessKeyId:z.string().min(1).max(256),secretAccessKey:z.string().min(1).max(4096),sessionToken:z.string().min(1).max(16384).optional()}).strict();
type Credential=z.infer<typeof credential>;
export type TemplateNativeObservation={kind:'bucket';providerStatus:200}|{kind:'object';providerStatus:200;objectVersion:string;versioningEnabled:true}|{kind:'access';url:string;signedAt:number;ttlSeconds:number;hardExpiresAt:number};
export interface TemplateNativePorts{
 /** Must return only after the exact durable parent/child/resource admission
  * commits. Unknown acknowledgement must reject, never authorize a command. */
 admit(binding:Readonly<TemplateExecutionBinding>):Promise<void>;
 assertCurrent(binding:Readonly<TemplateExecutionBinding>,timeCheck?:ExecutionTimeCheck):Promise<void>;
 clock:ExecutionTimeSource;
 signal?:AbortSignal;
 assertQualified(binding:Readonly<TemplateExecutionBinding>):Promise<void>;
 /** Private already-held resource only; no environment/file/provider fallback.
  * This metadata interface itself does not qualify actual credential custody. */
 readCredential(binding:Readonly<TemplateExecutionBinding>):Credential;
 now():number;
}
const fail=():never=>{throw Error('platform_template_native_unavailable')};
/** Prepared real SDK adapter. Unregistered; missing real supplier always refuses.
 * Opaque, once-only observations remain inside private server composition.
 * The enclosing service must atomically persist typed evidence/ciphertext with
 * parent/child/event transitions before any separately claimed output. */
export function createTemplateNativeTransport(ports?:TemplateNativePorts){
 const clock=ports?.clock;
 const used=new Set<string>(),observations=new WeakMap<object,{bindingDigest:string;value:Readonly<TemplateNativeObservation>}>();
 return {
  async perform(raw:unknown):Promise<object>{let sts:STSClient|undefined,s3:S3Client|undefined;try{
   const b=readTemplateExecutionBinding(raw),e=b.effect;if(!ports||used.has(b.bindingDigest))return fail();used.add(b.bindingDigest);
   if(e.kind!=='template.bucket.create'&&e.kind!=='template.object.put'&&e.kind!=='template.access.grant')return fail();
   const signal=ports.signal?AbortSignal.any([ports.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),p=ports;let currentKeys:Credential|undefined;
   async function within<T>(fn:()=>Promise<T>):Promise<T>{signal.throwIfAborted();let abort:()=>void=()=>{};const deadline=new Promise<never>((_resolve,reject)=>{abort=()=>reject(Error('platform_template_native_unavailable'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()});try{return await Promise.race([Promise.resolve().then(fn),deadline])}finally{signal.removeEventListener('abort',abort)}}
   function time(){const now=p.now();if(!Number.isSafeInteger(now)||now<0||now>=Date.parse(b.approvalExpiresAt))return fail();signal.throwIfAborted();return now}
   async function current(){time();await within(()=>p.assertQualified(b));await within(()=>authorizeExecutionWindow(clock!,{expiresAt:Date.parse(b.approvalExpiresAt)},check=>p.assertCurrent(b,check),signal));if(currentKeys){const live=credential.parse(p.readCredential(b));if(live.accessKeyId!==currentKeys.accessKeyId||live.secretAccessKey!==currentKeys.secretAccessKey||live.sessionToken!==currentKeys.sessionToken)return fail()}time()}
   // SDK preparation/signing can await after send() starts. Recheck at the
   // actual HTTP boundary, using the original locked authorization owner.
   function finalHandler(){const native=new NodeHttpHandler();return {metadata:native.metadata,destroy:()=>native.destroy(),async handle(request:Parameters<typeof native.handle>[0],options:Parameters<typeof native.handle>[1]){await current();signal.throwIfAborted();return native.handle(request,options)}}}
   await current();await within(()=>p.admit(b));await current();
   const keys=credential.parse(p.readCredential(b));currentKeys=keys;await current();const {accountId,region}=e.target;
   sts=new STSClient({region,credentials:keys,maxAttempts:1,requestHandler:finalHandler(),endpoint:`https://sts.${region}.amazonaws.com`});
   const identity=await within(()=>sts!.send(new GetCallerIdentityCommand({}),{abortSignal:signal}));await current();if(identity.Account!==accountId)return fail();
   s3=new S3Client({region,credentials:keys,maxAttempts:1,requestHandler:finalHandler(),endpoint:`https://s3.${region}.amazonaws.com`,followRegionRedirects:false,forcePathStyle:false,useAccelerateEndpoint:false,useDualstackEndpoint:false,useFipsEndpoint:false});
   let value:TemplateNativeObservation;
   if(e.kind==='template.bucket.create'){
    if(region!=='us-east-2')return fail();await current();const response=await within(()=>s3!.send(new CreateBucketCommand({Bucket:e.target.bucket,CreateBucketConfiguration:{LocationConstraint:'us-east-2'}}),{abortSignal:signal}));if(response.$metadata.httpStatusCode!==200)return fail();value={kind:'bucket',providerStatus:200};
   }else{
    const bytes=await within(()=>readPlatformTemplateBytes());if(createHash('sha256').update(bytes).digest('hex')!==e.target.bytesDigest)return fail();await current();
    const versioning=await within(()=>s3!.send(new GetBucketVersioningCommand({Bucket:e.target.bucket,ExpectedBucketOwner:accountId}),{abortSignal:signal}));await current();if(versioning.$metadata.httpStatusCode!==200||versioning.Status!=='Enabled')return fail();
    if(e.kind==='template.object.put'){
     await current();const response=await within(()=>s3!.send(new PutObjectCommand({Bucket:e.target.bucket,Key:e.target.key,ExpectedBucketOwner:accountId,IfNoneMatch:'*',Body:bytes,ContentType:'application/x-yaml',Metadata:{'axiom-template-sha256':e.target.bytesDigest}}),{abortSignal:signal}));if(response.$metadata.httpStatusCode!==200||typeof response.VersionId!=='string'||!response.VersionId||response.VersionId==='null'||response.VersionId.length>1024||/[\x00-\x1f]/.test(response.VersionId))return fail();value={kind:'object',providerStatus:200,objectVersion:response.VersionId,versioningEnabled:true};
    }else{
     if(!b.access)return fail();const target=e.target,object={Bucket:target.bucket,Key:target.key,VersionId:target.objectVersion,ExpectedBucketOwner:accountId};await current();const response=await within(()=>s3!.send(new GetObjectCommand(object),{abortSignal:signal}));await current();if(response.$metadata.httpStatusCode!==200||response.VersionId!==target.objectVersion||response.ContentLength!==bytes.length||!response.Body)return fail();const readback=await within(()=>readBoundedPlatformTemplateBody(response.Body,bytes.length,signal));if(createHash('sha256').update(readback).digest('hex')!==target.bytesDigest)return fail();
     // Durable admission already committed before credential acquisition. A
     // second fresh authority check precedes the actual async signing operation.
     await current();const signed=await within(()=>getSignedUrl(s3 as unknown as Parameters<typeof getSignedUrl>[0],new GetObjectCommand(object) as unknown as Parameters<typeof getSignedUrl>[1],{expiresIn:target.ttlSeconds}));await current();const url=validatePlatformTemplateSignedUrl(signed,target,keys.accessKeyId,time(),b.access.clockSkewMs),date=new URL(url).searchParams.get('X-Amz-Date')!;const signedAt=Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T'+date.slice(9,11)+':'+date.slice(11,13)+':'+date.slice(13,15)+'Z'),hardExpiresAt=signedAt+target.ttlSeconds*1000;if(!Number.isSafeInteger(hardExpiresAt)||hardExpiresAt<=time())return fail();value={kind:'access',url,signedAt,ttlSeconds:target.ttlSeconds,hardExpiresAt};
    }
   }
   await current();const proof=Object.freeze({});observations.set(proof,{bindingDigest:b.bindingDigest,value:Object.freeze(value)});return proof;
  }catch{return fail()}finally{sts?.destroy();s3?.destroy()}},
  consume(proof:object,raw:unknown):Readonly<TemplateNativeObservation>{const record=observations.get(proof);observations.delete(proof);const b=readTemplateExecutionBinding(raw);if(!record||record.bindingDigest!==b.bindingDigest)return fail();return record.value},
 };
}
