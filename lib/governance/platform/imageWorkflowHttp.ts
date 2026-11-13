import 'server-only';
import {createHash} from 'node:crypto';
import {readBoundedRequestJsonWithSize} from '@/lib/api/readBoundedRequestJson';
import {imageWorkflowCommand,imageArtifactIntakeResult,imageArtifactLookupResult,imagePreparedResult,imageActionLookupResult,imageWorkflowHistory,imageWorkflowPreview} from './imageWorkflowContract';
import {createDefaultImageWorkflowRequestService} from './imageWorkflowRequestService';
interface Service{initialize?(id:string,version:number,digest:string):Promise<unknown>;put?(id:string,version:number,digest:string):Promise<unknown>;intake(selection:unknown,bytes:Uint8Array):Promise<unknown>;lookupArtifact(reference:string):Promise<unknown>;prepare(artifactId:string,expiresAt:string,reference:string):Promise<unknown>;lookup(reference:string):Promise<unknown>;inspect(id:string):Promise<unknown>;preview(id:string):Promise<unknown>;review(id:string,version:number,digest:string):Promise<unknown>}
const uncertain={ok:false,error:'platform_image_workflow_unconfirmed',recovery:'inspect_same_action_or_lookup_original_reference_no_automatic_retry'};
function reply(body:unknown,status=200,max=128*1024){let text=JSON.stringify(body);if(new TextEncoder().encode(text).length>max){text=JSON.stringify(uncertain);status=409}return new Response(text,{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}})}
/** Prepared/unregistered. Exact image bytes occur only in deliberately requested
 * intake/preview. Exact initialize/put commands expose no credential, address or observation input. Defaults stay unqualified; no route is registered. */
export function createImageWorkflowHttp(factory:(request:Request)=>Promise<Service>=createDefaultImageWorkflowRequestService){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 let service:Service;try{service=await factory(request)}catch{return reply({ok:false,error:'platform_requester_unavailable'},401)}
 let c;try{
  const claimed=request.headers.get('content-length');if(claimed!==null&&(!/^\d+$/.test(claimed)||Number(claimed)>3*1024*1024))throw Error('body');
  const body=await readBoundedRequestJsonWithSize(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),3*1024*1024);
  c=imageWorkflowCommand.parse(body.value);
  if(c.operation!=='intake'&&body.byteLength>16384)throw Error('body');
 }catch{return reply({ok:false,error:'invalid_image_workflow_request'},400)}
 try{request.signal.throwIfAborted();let data;
  switch(c.operation){
   case 'intake':{
    const bytes=Buffer.from(c.bytesBase64url,'base64url');
    try{if(bytes.length<1||bytes.length>2097152||bytes.toString('base64url')!==c.bytesBase64url)throw Error('bytes');const hash=createHash('sha256').update(bytes).digest('hex');const value=imageArtifactIntakeResult.parse(await service.intake({connectionId:c.connectionId,mimeType:c.mimeType,requestReference:c.requestReference},bytes));if(value.requestReference!==c.requestReference||value.artifact.connectionId!==c.connectionId||value.artifact.mimeType!==c.mimeType||value.artifact.bytesDigest!==hash||value.artifact.byteCount!==bytes.length)throw Error('mismatch');data=value}finally{bytes.fill(0)}break;
   }
   case 'lookup_artifact':{const value=imageArtifactLookupResult.parse(await service.lookupArtifact(c.requestReference));if(value.requestReference!==c.requestReference)throw Error('mismatch');data=value;break}
   case 'prepare':data={...imagePreparedResult.parse(await service.prepare(c.artifactId,c.expiresAt,c.requestReference)),requestReference:c.requestReference};break;
   case 'lookup':data={...imageActionLookupResult.parse(await service.lookup(c.requestReference)),requestReference:c.requestReference};break;
   case 'preview':{
    const value=imageWorkflowPreview.parse(await service.preview(c.actionId)),bytes=Buffer.from(value.bytesBase64url,'base64url');
    try{if(value.action.actionId!==c.actionId||bytes.length!==value.artifact.byteCount||bytes.toString('base64url')!==value.bytesBase64url||createHash('sha256').update(bytes).digest('hex')!==value.artifact.bytesDigest)throw Error('mismatch');data=value}finally{bytes.fill(0)}break;
   }
   case 'initialize':case 'put':{
    const method=c.operation==='initialize'?service.initialize:service.put;if(!method)throw Error('unavailable');
    const value=imageWorkflowHistory.parse(await method.call(service,c.actionId,c.expectedVersion,c.planDigest));
    if(value.action.actionId!==c.actionId||value.action.plan.digest!==c.planDigest||!value.upload||c.operation==='initialize'&&(value.action.status!=='claimed'||value.action.effects[0]?.status!=='confirmed'||!value.upload.grant)||c.operation==='put'&&(value.action.status!=='confirmed'||!value.upload.grant?.result?.ready))throw Error('mismatch');
    data=value;break;
   }
   default:{const value=imageWorkflowHistory.parse(await(c.operation==='inspect'?service.inspect(c.actionId):service.review(c.actionId,c.expectedVersion,c.planDigest)));if(value.action.actionId!==c.actionId||c.operation==='review'&&(value.action.plan.digest!==c.planDigest||value.action.status!=='approved'))throw Error('mismatch');data=value}
  }
  request.signal.throwIfAborted();return reply({ok:true,data},200,c.operation==='preview'?3*1024*1024:128*1024);
 }catch{return reply(uncertain,409)}
}}
