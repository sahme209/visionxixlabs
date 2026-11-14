import {assertExecutionWindow,prepareExecutionDispatch,consumeExecutionDispatch,type ExecutionTimeSource,type ExecutionTimeAuthorization} from '../executionTime';
import 'server-only';
import {ECSClient,DescribeServicesCommand} from '@aws-sdk/client-ecs';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {boundedAwsHandler,awsReadEndpoint} from '@/lib/cloud/aws/ecsObservation/boundedAwsHandler';
import {readOperationalManifest} from './kernel';
import {operationalEcsTarget} from './contracts';
import {buildOperationalEcsUpdate} from './ecsProtocol';
import type {OperationalEcsTransport,OperationalEcsDispatchCurrent} from './ecsExecution';
const credentialSchema=z.object({accessKeyId:z.string().min(1).max(128),secretAccessKey:z.string().min(1).max(8192),sessionToken:z.string().min(1).max(16384),expiresAt:z.number().int().positive().safe()}).strict();
type Credential=Parameters<OperationalEcsTransport['send']>[1];
const fail=():never=>{throw Error('operational_ecs_transport_unavailable')};
/** Private fixed-operation boundary shared by update and describe. The exact
 * action header and serialized input prevent a read command becoming a write. */
async function signedRequest(clock:ExecutionTimeSource,region:string,rawCredential:Credential,operation:'UpdateService'|'DescribeServices',input:unknown,beforeRequest:ExecutionTimeAuthorization,signal:AbortSignal,send:(client:ECSClient)=>Promise<unknown>,actionExpiresAt?:number,dispatchCurrent?:OperationalEcsDispatchCurrent){
 let client:ECSClient|undefined;
 try{
  const credential=credentialSchema.parse(rawCredential);if(typeof dispatchCurrent!=='function')return fail();if(!(signal instanceof AbortSignal)||signal.aborted||[credential.accessKeyId,credential.secretAccessKey,credential.sessionToken].some(s=>/[\s\x00-\x1f\x7f]/.test(s)))return fail();
  await assertExecutionWindow(clock,{expiresAt:Math.min(credential.expiresAt,actionExpiresAt??credential.expiresAt)},signal);
  const endpoint=new URL(awsReadEndpoint('ecs',region,'aws')),expected=sha256ContentHash(input),bounded=boundedAwsHandler(signal,{remaining:65536},{maxBytes:65536,timeoutMs:6000});let used=false;
  const handler={metadata:bounded.metadata,destroy:()=>bounded.destroy(),async handle(request:Parameters<typeof bounded.handle>[0],options:Parameters<typeof bounded.handle>[1]){
   if(used||signal.aborted||request.protocol!=='https:'||request.hostname!==endpoint.hostname||request.port!==undefined&&request.port!==443||request.path!=='/'||request.method!=='POST'||Object.keys(request.query??{}).length||request.headers['x-amz-target']!=='AmazonEC2ContainerServiceV20141113.'+operation)return fail();used=true;
   const bytes=typeof request.body==='string'?Buffer.from(request.body,'utf8'):request.body instanceof Uint8Array?Buffer.from(request.body):null;
   if(!bytes||bytes.byteLength>16384||sha256ContentHash(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))!==expected||!request.headers.authorization?.startsWith('AWS4-HMAC-SHA256 Credential='+credential.accessKeyId+'/')||!request.headers.authorization.includes('/'+region+'/ecs/aws4_request')||request.headers['x-amz-security-token']!==credential.sessionToken)return fail();
   const authorization=request.headers.authorization;
   const requestCurrent=()=>{
    const body=typeof request.body==='string'?Buffer.from(request.body,'utf8'):request.body instanceof Uint8Array?Buffer.from(request.body):null;
    if(request.protocol!=='https:'||request.hostname!==endpoint.hostname||request.port!==undefined&&request.port!==443||request.path!=='/'||request.method!=='POST'||Object.keys(request.query??{}).length||request.headers['x-amz-target']!=='AmazonEC2ContainerServiceV20141113.'+operation||request.headers.authorization!==authorization||request.headers['x-amz-security-token']!==credential.sessionToken||!body||body.byteLength>16384||sha256ContentHash(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body)))!==expected)return fail();
   };
   const binding=Object.freeze({operation,region,inputDigest:expected,credentialExpiresAt:credential.expiresAt});
   const facts=async()=>{requestCurrent();await dispatchCurrent(binding,signal);signal.throwIfAborted();requestCurrent()};
   const checkpoint=await prepareExecutionDispatch(clock,{expiresAt:Math.min(credential.expiresAt,actionExpiresAt??credential.expiresAt)},beforeRequest,signal,binding,facts,operation==='UpdateService'?facts:undefined);
   await consumeExecutionDispatch(checkpoint,binding);signal.throwIfAborted();return bounded.handle(request,options);
  }};
  client=new ECSClient({region,credentials:{accessKeyId:credential.accessKeyId,secretAccessKey:credential.secretAccessKey,sessionToken:credential.sessionToken,expiration:new Date(credential.expiresAt)},endpoint:endpoint.href,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,maxAttempts:1,requestHandler:handler});
  const result=await send(client);signal.throwIfAborted();return result;
 }catch{return fail()}finally{client?.destroy()}
}
/** No qualified profile/default credential supplier. No waiter or rollback. */
export function createOperationalEcsSdkTransport(assertQualified:OperationalEcsTransport['assertQualified'],clock:ExecutionTimeSource,dispatchCurrent?:OperationalEcsDispatchCurrent):OperationalEcsTransport{
 return Object.freeze({assertQualified,async send(rawManifest:Parameters<OperationalEcsTransport['send']>[0],credential:Credential,beforeSend:ExecutionTimeAuthorization,signal:AbortSignal){
  const manifest=readOperationalManifest(rawManifest);if(manifest.kind!=='deployment.ecs')return fail();const command=buildOperationalEcsUpdate(manifest);
  return signedRequest(clock,manifest.target.region,credential,'UpdateService',command.input,beforeSend,signal,client=>client.send(command,{abortSignal:signal}),Date.parse(manifest.expiresAt),dispatchCurrent);
 }});
}
/** Exact read-only transport only. A separate current-reader/profile/custody
 * source must supply read credentials and the final gate. No token reuse from
 * an already-consumed write handle or ambient credential provider is offered. */
export function createOperationalEcsSdkReader(clock:ExecutionTimeSource,dispatchCurrent?:OperationalEcsDispatchCurrent){return Object.freeze({async describe(rawTarget:unknown,credential:Credential,beforeRead:ExecutionTimeAuthorization,signal:AbortSignal){
 const target=operationalEcsTarget.parse(rawTarget),command=new DescribeServicesCommand({cluster:target.clusterArn,services:[target.serviceArn]});
 return signedRequest(clock,target.region,credential,'DescribeServices',command.input,beforeRead,signal,client=>client.send(command,{abortSignal:signal}),undefined,dispatchCurrent);
}})}
