import 'server-only';
import {ECSClient} from '@aws-sdk/client-ecs';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {boundedAwsHandler,awsReadEndpoint} from '@/lib/cloud/aws/ecsObservation/boundedAwsHandler';
import {readOperationalManifest} from './kernel';
import {buildOperationalEcsUpdate} from './ecsProtocol';
import type {OperationalEcsTransport} from './ecsExecution';
const credentialSchema=z.object({accessKeyId:z.string().min(1).max(128),secretAccessKey:z.string().min(1).max(8192),sessionToken:z.string().min(1).max(16384),expiresAt:z.number().int().positive().safe()}).strict();
const fail=():never=>{throw Error('operational_ecs_transport_unavailable')};
/** Private actual-SDK implementation. Qualification must come from the actual
 * deployment profile; no default exists. Endpoint/credentials/retries are never
 * inherited from the environment. No waiter or automatic rollback. */
export function createOperationalEcsSdkTransport(assertQualified:OperationalEcsTransport['assertQualified']):OperationalEcsTransport{
 return Object.freeze({assertQualified,async send(rawManifest:Parameters<OperationalEcsTransport['send']>[0],rawCredential:Parameters<OperationalEcsTransport['send']>[1],beforeSend:()=>Promise<void>,signal:AbortSignal){
  let client:ECSClient|undefined;
  try{
   const manifest=readOperationalManifest(rawManifest),credential=credentialSchema.parse(rawCredential);if(manifest.kind!=='deployment.ecs'||!(signal instanceof AbortSignal)||signal.aborted||credential.expiresAt<=Date.now()||[credential.accessKeyId,credential.secretAccessKey,credential.sessionToken].some(s=>/[\s\x00-\x1f\x7f]/.test(s)))return fail();
   const command=buildOperationalEcsUpdate(manifest),endpoint=new URL(awsReadEndpoint('ecs',manifest.target.region,'aws')),expected=sha256ContentHash(command.input),bounded=boundedAwsHandler(signal,{remaining:65536},{maxBytes:65536,timeoutMs:6000});let used=false;
   const handler={metadata:bounded.metadata,destroy:()=>bounded.destroy(),async handle(request:Parameters<typeof bounded.handle>[0],options:Parameters<typeof bounded.handle>[1]){
    if(used||signal.aborted||request.protocol!=='https:'||request.hostname!==endpoint.hostname||request.port!==undefined&&request.port!==443||request.path!=='/'||request.method!=='POST'||Object.keys(request.query??{}).length||request.headers['x-amz-target']!=='AmazonEC2ContainerServiceV20141113.UpdateService')return fail();used=true;
    const bytes=typeof request.body==='string'?Buffer.from(request.body,'utf8'):request.body instanceof Uint8Array?Buffer.from(request.body):null;
    if(!bytes||bytes.byteLength>16384||sha256ContentHash(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))!==expected||!request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 Credential='+credential.accessKeyId+'/')||!request.headers.authorization.includes('/'+manifest.target.region+'/ecs/aws4_request')||request.headers['x-amz-security-token']!==credential.sessionToken)return fail();
    await beforeSend();signal.throwIfAborted();if(credential.expiresAt<=Date.now())return fail();return bounded.handle(request,options);
   }};
   client=new ECSClient({region:manifest.target.region,credentials:{accessKeyId:credential.accessKeyId,secretAccessKey:credential.secretAccessKey,sessionToken:credential.sessionToken,expiration:new Date(credential.expiresAt)},endpoint:endpoint.href,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,maxAttempts:1,requestHandler:handler});
   const result=await client.send(command,{abortSignal:signal});signal.throwIfAborted();return result;
  }catch{return fail()}finally{client?.destroy()}
 }});
}
