/** Legacy metadata entry points. Execution moved to the separately reviewed
 * template executor with durable native-resource admission and scoped output.
 * These shims never read broker credentials, write, sign or adopt old plans. */
import 'server-only';
import type {TemplateAccessInput,templateAccessEffect} from './platformTemplatePlan';
const MAX_BYTES=256*1024;
const fail=():never=>{throw Error('platform_template_unavailable')};
export async function createPlatformTemplateBucket(_input:{accountId:string;region:string;platformExecution:object;effectId?:string}):Promise<never>{return fail()}
export async function publishPlatformTemplateObject(_input:{accountId:string;region:string;platformExecution:object;effectId?:string}):Promise<never>{return fail()}
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
 return {available:false,reason:!opts.platformExecution||!opts.access?'platform_review_required':'platform_template_unavailable',detail:'Use the separately reviewed template workflow. Legacy metadata, overrides and bindings cannot create, upload or sign a template grant.'};
}
/** Shared private validation only; exports do not grant credentials or authority. */
export {boundedBody as readBoundedPlatformTemplateBody,validateSignedUrl as validatePlatformTemplateSignedUrl};
