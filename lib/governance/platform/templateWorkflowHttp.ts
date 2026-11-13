import 'server-only';
import {z} from 'zod';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {platformActionId} from './viewContract';
import {templateWorkflowCommand,templateWorkflowHistory,templateWorkflowPreview,templateWorkflowOutput} from './templateWorkflowContract';
import {createDefaultTemplateWorkflowRequestService} from './templateWorkflowRequestService';
interface Service{prepare(selection:unknown,reference:string):Promise<unknown>;lookup(reference:string):Promise<unknown>;inspect(id:string):Promise<unknown>;preview(id:string):Promise<unknown>;review(id:string,version:number,digest:string):Promise<unknown>;execute(id:string,version:number,digest:string):Promise<unknown>;deliver(id:string,ref:string,digest:string):Promise<unknown>}
const reference=z.string().uuid(),prepared=z.object({actionId:platformActionId,historical:z.boolean(),authority:z.literal('proposal_reference_only')}).strict(),lookup=z.discriminatedUnion('found',[z.object({found:z.literal(true),actionId:platformActionId,authority:z.literal('history_only')}).strict(),z.object({found:z.literal(false),authority:z.literal('history_only')}).strict()]);
const unconfirmed={ok:false,error:'platform_template_workflow_unconfirmed',recovery:'inspect_same_action_or_lookup_original_reference_no_automatic_retry'};
function reply(body:unknown,status=200,max=128*1024){let text=JSON.stringify(body);if(new TextEncoder().encode(text).length>max){text=JSON.stringify(unconfirmed);status=409}return new Response(text,{status,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}})}
/** Prepared/unregistered. Only the separate exact delivery reply may contain a
 * transient bearer URL. No route, real supplier or permission is enabled here. */
export function createTemplateWorkflowHttp(factory:(request:Request)=>Promise<Service>=createDefaultTemplateWorkflowRequestService){return async(request:Request)=>{
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);let service:Service;try{service=await factory(request)}catch{return reply({ok:false,error:'platform_requester_unavailable'},401)}
 let c;try{c=templateWorkflowCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),16384))}catch{return reply({ok:false,error:'invalid_template_workflow_request'},400)}
 try{request.signal.throwIfAborted();let data;switch(c.operation){
  case 'prepare':data={...prepared.parse(await service.prepare(c.selection,c.requestReference)),requestReference:reference.parse(c.requestReference)};break;
  case 'lookup':data={...lookup.parse(await service.lookup(c.requestReference)),requestReference:reference.parse(c.requestReference)};break;
  case 'preview':{const v=templateWorkflowPreview.parse(await service.preview(c.actionId));if(v.action.actionId!==c.actionId)throw Error('mismatch');data=v;break}
  case 'deliver':{const v=templateWorkflowOutput.parse(await service.deliver(c.actionId,c.artifactRef,c.planDigest));if(v.actionId!==c.actionId||v.artifactRef!==c.artifactRef)throw Error('mismatch');data=v;break}
  default:{const v=templateWorkflowHistory.parse(await(c.operation==='inspect'?service.inspect(c.actionId):c.operation==='review'?service.review(c.actionId,c.expectedVersion,c.planDigest):service.execute(c.actionId,c.expectedVersion,c.planDigest)));if(v.action.actionId!==c.actionId||c.operation!=='inspect'&&v.action.plan.digest!==c.planDigest||c.operation==='review'&&v.action.status!=='approved'||c.operation==='execute'&&v.action.status!=='confirmed')throw Error('mismatch');data=v}
 }request.signal.throwIfAborted();return reply({ok:true,data},200,c.operation==='preview'?2*1024*1024:c.operation==='deliver'?16384:128*1024)}catch{return reply(unconfirmed,409)}
}}
