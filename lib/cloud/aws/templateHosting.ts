/** Platform template hosting: separate reviewed bucket/object/access effects.
 * Legacy GET/cache/operator override is not authority. No retry or public ACL.
 * Existing object versions are observed before a signed bearer URL is granted;
 * intended recipient metadata does not make that URL nontransferable. */
import 'server-only';
import {readPlatformTemplateBytes as templateBytes} from './platformTemplateSource';
import {createHash} from 'node:crypto';
import {S3Client,CreateBucketCommand,PutObjectCommand,GetObjectCommand,GetBucketVersioningCommand} from '@aws-sdk/client-s3';
import {STSClient,GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {runPlatformEffect} from '@/lib/governance/platform/effectExecution';
import {templateBucketEffect,templateObjectEffect,templateAccessEffect,templateRegion,type TemplateAccessInput} from './platformTemplatePlan';
const MAX_BYTES=256*1024;
const fail=():never=>{throw Error('platform_template_unavailable')};
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
async function withBroker<T>(accountId:string,rawRegion:string,work:(s3:S3Client,signal:AbortSignal,current:()=>void)=>Promise<T>):Promise<T>{
 const region=templateRegion(rawRegion),accessKeyId=process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID?.trim(),secretAccessKey=process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY?.trim();
 if(!accessKeyId||!secretAccessKey)fail();
 const credentials={accessKeyId:accessKeyId!,secretAccessKey:secretAccessKey!},signal=AbortSignal.timeout(15000);
 const current=()=>{signal.throwIfAborted();if(process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID?.trim()!==accessKeyId||process.env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY?.trim()!==secretAccessKey)fail()};
 const sts=new STSClient({region,credentials,maxAttempts:1,endpoint:`https://sts.${region}.amazonaws.com`});
 let s3:S3Client|undefined;
 try{
  const identity=await sts.send(new GetCallerIdentityCommand({}),{abortSignal:signal});current();if(identity.Account!==accountId)fail();
  s3=new S3Client({region,credentials,maxAttempts:1,endpoint:`https://s3.${region}.amazonaws.com`,followRegionRedirects:false,forcePathStyle:false,useAccelerateEndpoint:false,useDualstackEndpoint:false,useFipsEndpoint:false});
  return await work(s3,signal,current);
 }finally{sts.destroy();s3?.destroy()}
}
export async function createPlatformTemplateBucket(input:{accountId:string;region:string;platformExecution:object;effectId?:string}){
 const effect=templateBucketEffect(input.accountId,input.region,input.effectId),{accountId,region,bucket}=effect.target;
 // AWS documents that recreating an owned us-east-1 bucket resets ACLs.
 // Other regions return conflict instead; never convert conflict to success.
 const createRegion=templateRegion(region);if(createRegion==='us-east-1')return fail();
 return runPlatformEffect(input.platformExecution,effect,beforeSend=>withBroker(accountId,region,async(s3,signal,current)=>{
  await beforeSend();current();
  const result=await s3.send(new CreateBucketCommand({Bucket:bucket,CreateBucketConfiguration:{LocationConstraint:createRegion}}),{abortSignal:signal});current();
  if(result.$metadata.httpStatusCode!==200)fail();return {outcome:'confirmed',value:{accountId,region,bucket}};
 }));
}
export async function publishPlatformTemplateObject(input:{accountId:string;region:string;platformExecution:object;effectId?:string}){
 const bytes=await templateBytes(),effect=templateObjectEffect(input.accountId,input.region,sha(bytes),input.effectId),{accountId,region,bucket,key,bytesDigest}=effect.target;
 return runPlatformEffect(input.platformExecution,effect,beforeSend=>withBroker(accountId,region,async(s3,signal,current)=>{
  const versioning=await s3.send(new GetBucketVersioningCommand({Bucket:bucket,ExpectedBucketOwner:accountId}),{abortSignal:signal});current();if(versioning.Status!=='Enabled')fail();
  await beforeSend();current();
  const result=await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,ExpectedBucketOwner:accountId,IfNoneMatch:'*',Body:bytes,ContentType:'application/x-yaml',Metadata:{'axiom-template-sha256':bytesDigest}}),{abortSignal:signal});current();
  if(result.$metadata.httpStatusCode!==200)fail();
  const objectVersion=typeof result.VersionId==='string'&&result.VersionId&&result.VersionId!=='null'?result.VersionId:null;
  return {outcome:'confirmed',value:{accountId,region,bucket,key,bytesDigest,objectVersion,requiresVersioning:objectVersion===null}};
 }));
}
async function boundedBody(body:unknown,expected:number,signal:AbortSignal){
 if(!body||typeof body!=='object'||!(Symbol.asyncIterator in body))fail();
 const stream=body as AsyncIterable<Uint8Array>&{destroy?:()=>void},iterator=stream[Symbol.asyncIterator](),parts:Buffer[]=[];let size=0,complete=false;
 try{
  while(true){
   signal.throwIfAborted();
   const item=await new Promise<IteratorResult<Uint8Array>>((resolve,reject)=>{
    const abort=()=>reject(Error('platform_template_unavailable'));signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){signal.removeEventListener('abort',abort);abort();return}
    Promise.resolve().then(()=>iterator.next()).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
   });
   signal.throwIfAborted();if(item.done)break;
   if(!(item.value instanceof Uint8Array)||(size+=item.value.byteLength)>MAX_BYTES||size>expected)fail();parts.push(Buffer.from(item.value));
  }
  if(size!==expected)fail();complete=true;return Buffer.concat(parts);
 }finally{if(!complete){stream.destroy?.();void Promise.resolve(iterator.return?.()).catch(()=>{})}}
}
function validateSignedUrl(raw:string,target:ReturnType<typeof templateAccessEffect>['target'],expectedAccessKey:string|undefined,observedNow=Date.now(),clockSkewMs=30000){
 let u:URL;try{u=new URL(raw)}catch{return fail()}
 const hosts=[`${target.bucket}.s3.${target.region}.amazonaws.com`,...(target.region==='us-east-1'?[`${target.bucket}.s3.amazonaws.com`]:[])];
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!hosts.includes(u.hostname)||u.pathname!=='/'+target.key)fail();
 const allowed=new Set(['versionId','X-Amz-Algorithm','X-Amz-Content-Sha256','X-Amz-Credential','X-Amz-Date','X-Amz-Expires','X-Amz-SignedHeaders','X-Amz-Signature','X-Amz-Security-Token','x-id','x-amz-checksum-mode','x-amz-expected-bucket-owner']);
 for(const key of u.searchParams.keys())if(!allowed.has(key)||u.searchParams.getAll(key).length!==1)fail();
 if(u.searchParams.get('versionId')!==target.objectVersion||u.searchParams.get('X-Amz-Expires')!==String(target.ttlSeconds)||u.searchParams.get('X-Amz-SignedHeaders')!=='host'||u.searchParams.get('X-Amz-Algorithm')!=='AWS4-HMAC-SHA256')fail();
 const signature=u.searchParams.get('X-Amz-Signature')??'',date=u.searchParams.get('X-Amz-Date')??'',credential=(u.searchParams.get('X-Amz-Credential')??'').split('/');
 if(!/^[a-f0-9]{64}$/i.test(signature)||!/^\d{8}T\d{6}Z$/.test(date)||!expectedAccessKey||credential.length!==5||credential[0]!==expectedAccessKey||credential[1]!==date.slice(0,8)||credential[2]!==target.region||credential[3]!=='s3'||credential[4]!=='aws4_request'||u.searchParams.get('x-amz-expected-bucket-owner')!==target.accountId)fail();
 const signedAt=Date.parse(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T'+date.slice(9,11)+':'+date.slice(11,13)+':'+date.slice(13,15)+'Z');
 if(!Number.isFinite(signedAt)||(!Number.isSafeInteger(observedNow)||!Number.isSafeInteger(clockSkewMs)||clockSkewMs<1)||Math.abs(observedNow-signedAt)>clockSkewMs||signedAt+target.ttlSeconds*1000<=observedNow)fail();
 if(u.searchParams.has('x-id')&&u.searchParams.get('x-id')!=='GetObject')fail();
 if(u.searchParams.has('x-amz-checksum-mode')&&u.searchParams.get('x-amz-checksum-mode')!=='ENABLED')fail();
 if(u.searchParams.has('X-Amz-Content-Sha256')&&u.searchParams.get('X-Amz-Content-Sha256')!=='UNSIGNED-PAYLOAD')fail();
 return raw;
}
export interface PublishResult{available:true;url:string;bucket:string;publishedNow:boolean;brokerAccountId:string}
export interface PublishError{available:false;reason:'platform_review_required'|'platform_template_unavailable';detail:string;brokerArn?:string;bucket?:string}
export async function ensureTemplatePublished(opts:{forceRefresh?:boolean;platformExecution?:object;access?:Omit<TemplateAccessInput,'bytesDigest'>}={}):Promise<PublishResult|PublishError>{
 if(!opts.platformExecution||!opts.access)return {available:false,reason:'platform_review_required',detail:'A platform operator must prepare and independently review this exact template access grant.'};
 try{
  const bytes=await templateBytes(),effect=templateAccessEffect({...opts.access,bytesDigest:sha(bytes)}),target=effect.target;
  const grant=await runPlatformEffect(opts.platformExecution,effect,beforeSend=>withBroker(target.accountId,target.region,async(s3,signal,current)=>{
   const object={Bucket:target.bucket,Key:target.key,VersionId:target.objectVersion,ExpectedBucketOwner:target.accountId};
   const response=await s3.send(new GetObjectCommand(object),{abortSignal:signal});current();
   if(response.VersionId!==target.objectVersion||response.ContentLength!==bytes.length||!response.Body)fail();
   if(sha(await boundedBody(response.Body,bytes.length,signal))!==target.bytesDigest)fail();
   // Prepare the URL privately, then recheck authority after the async signer
   // and immediately before releasing this bearer access grant.
   const signed=await getSignedUrl(s3 as unknown as Parameters<typeof getSignedUrl>[0],new GetObjectCommand(object) as unknown as Parameters<typeof getSignedUrl>[1],{expiresIn:target.ttlSeconds});current();
   const url=validateSignedUrl(signed,target,process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID?.trim());
   await beforeSend();current();validateSignedUrl(url,target,process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID?.trim());
   return {outcome:'confirmed',value:{available:true as const,url,bucket:target.bucket,publishedNow:false,brokerAccountId:target.accountId}};
  }));
  // Recording can itself outlast a short grant. Never release an expired URL
  // and never sign again to conceal the original consumed attempt.
  validateSignedUrl(grant.url,target,process.env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID?.trim());
  return grant;
 }catch{return {available:false,reason:'platform_template_unavailable',detail:'The exact template version, current authority or access outcome could not be verified. No automatic retry was made.'}}
}

/** Shared private validation only; exports do not grant credentials or authority. */
export {boundedBody as readBoundedPlatformTemplateBody,validateSignedUrl as validatePlatformTemplateSignedUrl};
