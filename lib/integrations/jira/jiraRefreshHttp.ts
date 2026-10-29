import 'server-only';
import {JiraRefreshPersistenceOutcomeUnknown} from './jiraRefreshPersistence';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {isSameOriginRequest} from '@/lib/auth/requestOrigin';
import {consumeToken} from '@/lib/api/rateLimiter';
import {readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
const actorSchema=z.object({organizationId:z.string().min(1).max(240),userId:z.string().min(1).max(240),canManageConnections:z.literal(true)}).strict();
const requestSchema=z.object({connectionId:z.string().min(1).max(240),revision:z.string().datetime()}).strict();
export function createJiraRefreshHttp(ports:{enabled:()=>boolean;readCurrentActor:()=>Promise<unknown>;refresh:(actor:unknown,input:unknown,signal:AbortSignal)=>Promise<{connectionId:string;revision:string;refreshed:boolean;connectionReadinessVerified:false}>}){
 const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 return async(request:NextRequest)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  if(!ports.enabled())return reply({ok:false,error:'jira_refresh_disabled'},503);
  if(!isSameOriginRequest(request))return reply({ok:false,error:'invalid_request_origin'},403);
  if(request.nextUrl.search||request.url.length>2048||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!request.body)return reply({ok:false,error:'invalid_jira_refresh'},400);
  let actor:z.infer<typeof actorSchema>;try{actor=actorSchema.parse(await ports.readCurrentActor())}catch{return reply({ok:false,error:'workspace_owner_required'},401)}
  if(!consumeToken(`jira-refresh:${actor.organizationId}:${actor.userId}`,{capacity:2,tokensPerSecond:1/120}).allowed)return reply({ok:false,error:'jira_refresh_rate_limited'},429);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(35000)]);
  let input:z.infer<typeof requestSchema>;try{input=requestSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(new Response(request.body),signal,1024))))}catch{return reply({ok:false,error:'invalid_jira_refresh'},400)}
  try{if(!ports.enabled())throw Error();const data=await ports.refresh(actor,input,signal);return reply({ok:true,data},200)}catch(error){return reply({ok:false,error:error instanceof JiraRefreshPersistenceOutcomeUnknown?'jira_refresh_outcome_unknown':'jira_refresh_unavailable',retryAllowed:false},409)}
 };
}
