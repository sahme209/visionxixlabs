import 'server-only';
import {z} from 'zod';
import {serviceNowInstanceOriginSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {untilAbort} from '@/lib/releaseops/jiraTicketTransport';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
export interface ServiceNowReadDiagnostic {phase:'before_dispatch'|'provider_response'|'model_body'|'model_validation'|'final_validation';httpStatus:number|null;resultIsArray:boolean|null;modelCount:number|null}
interface ReadInput {onDiagnostic?:(diagnostic:Readonly<ServiceNowReadDiagnostic>)=>void;instanceOrigin:string;token:{accessToken:string;refreshToken:string|null;expiresAt:number;scopes:string[]};signal:AbortSignal;fetchImpl?:typeof fetch;now?:()=>number}
const label=z.string().min(1).max(200).refine(v=>v.trim().length>0&&!/[\x00-\x1f\x7f-\x9f]/.test(v));
const wrapped=<T extends z.ZodType>(value:T)=>z.object({value}).passthrough();
const queryMetadata=z.object({__meta:z.object({encodedQuery:z.literal(''),fields:z.object({applied:z.tuple([]),ignored:z.tuple([])}).strict()}).strict()}).strict();
const model=z.object({sys_id:wrapped(z.string().regex(/^[a-f0-9]{32}$/)),name:wrapped(label),active:wrapped(z.boolean()),table_name:wrapped(z.literal('change_request')),state_field:wrapped(z.literal('state'))}).passthrough();
/** Fixed read-only API probe; the model names do not establish mandatory fields,
 * approval bypass, terminal states, write authority or effective native forms. */
export async function readServiceNowModels(input:ReadInput){
 let response:Response|undefined;
 const diagnostic:ServiceNowReadDiagnostic={phase:'before_dispatch',httpStatus:null,resultIsArray:null,modelCount:null};
 try{
  const instanceOrigin=serviceNowInstanceOriginSchema.parse(input.instanceOrigin),clock=input.now??Date.now;
  const accessToken=z.string().min(1).max(65536).refine(v=>!/[\x00-\x20\x7f-\x9f]/.test(v)).parse(input.token.accessToken);
  if(input.token.scopes.length!==1||input.token.scopes[0]!=='axiom.change_management'||!Number.isSafeInteger(input.token.expiresAt))throw Error();
  const signal=AbortSignal.any([input.signal,AbortSignal.timeout(15000)]);
  const current=()=>{signal.throwIfAborted();const now=clock();if(!Number.isSafeInteger(now)||now<0||input.token.expiresAt<=now)throw Error();return now};
  current();
  diagnostic.phase='provider_response';
  response=await untilAbort((input.fetchImpl??fetch)(instanceOrigin+'/api/sn_chg_rest/v1/change/model',{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{accept:'application/json',Authorization:`Bearer ${accessToken}`},signal}),signal,late=>{void late.body?.cancel().catch(()=>{})});
  diagnostic.httpStatus=response.status;current();if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw Error();
  diagnostic.phase='model_body';const bytes=await readBoundedGithubBody(response,signal,262144),body:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  diagnostic.phase='model_validation';const result=body&&typeof body==='object'&&!Array.isArray(body)?(body as Record<string,unknown>).result:undefined;diagnostic.resultIsArray=Array.isArray(result);diagnostic.modelCount=Array.isArray(result)?Math.min(result.length,101):null;
  const raw=z.object({result:z.array(z.unknown()).max(101)}).parse(body);
  // Native Brazil responses append query metadata to the model array. Recognize
  // only the exact empty-query trailer observed for this fixed, parameter-free GET.
  // It grants no model or action authority; all other records remain model-validated.
  const modelRecords=raw.result.map((record,index)=>{
   if(record&&typeof record==='object'&&!Array.isArray(record)&&Object.hasOwn(record,'__meta')){
    if(index!==raw.result.length-1)throw Error();queryMetadata.parse(record);return null;
   }
   return model.parse(record);
  }).filter((record):record is z.infer<typeof model>=>record!==null);
  if(modelRecords.length>100)throw Error();
  const models=modelRecords.map(m=>({sysId:m.sys_id.value,name:m.name.value,active:m.active.value})).sort((a,b)=>a.sysId.localeCompare(b.sysId));
  if(new Set(models.map(m=>m.sysId)).size!==models.length)throw Error();
  diagnostic.phase='final_validation';return{instanceOrigin,models,observedAt:new Date(current()).toISOString(),digest:sha256ContentHash({instanceOrigin,models})};
 }catch{try{input.onDiagnostic?.(Object.freeze({...diagnostic}))}catch{/* Diagnostics cannot affect refusal or initiate retries. */}throw Error('servicenow_read_access_unavailable')}finally{void response?.body?.cancel().catch(()=>{})}
}
