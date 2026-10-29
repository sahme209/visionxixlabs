import 'server-only';
import {z} from 'zod';
import {NextResponse,type NextRequest} from 'next/server';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {awsGuidedRequestSchema,awsGuidedResponseSchema} from './contract';
import {createAwsGuidedRuntime} from './runtime';
import {AwsEnrollmentError} from '../enrollment/policy';
const reply=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'private, no-store'}});
export async function handleAwsGuided(request:NextRequest){try{
 const p=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:request.method==='GET'?'workspace:read':'connections:manage',requireWorkspaceAdmin:true,allowApiKey:false,route:'AWS guided connection'});
 if(!p||p.credentialKind!=='desktop_session')return reply({ok:false,error:'desktop_session_required'},401);
 const s={organizationId:p.organizationId,userId:p.userId,sessionId:p.id},service=createAwsGuidedRuntime();
 if(request.method==='GET'){if(request.nextUrl.search)return reply({ok:false,error:'invalid_request'},400);try{return reply({ok:true,data:awsGuidedResponseSchema.parse(await service.list(s))})}catch(e){if(e&&typeof e==='object'&&'code'in e&&['P2021','P2022'].includes(String(e.code)))return reply({ok:true,data:{available:false,reason:'storage_unavailable',choices:[],flows:[]}});throw e}}
 if(request.method!=='POST'||request.nextUrl.search||!request.body||request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply({ok:false,error:'invalid_request'},400);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]),bytes=await readBoundedGithubBody(new Response(request.body),signal,1024),input=awsGuidedRequestSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 await (input.action==='start'?await service.start(s,input.choiceId,input.clientRequestId):await service.act(s,input.flowId,input.expectedVersion,input.action,input.action==='review'?input.proposalDigest:undefined));
 // The native client consumes the same full, freshly authorized snapshot for
 // reads and mutations. A mutation receipt alone is not connection readiness.
 return reply({ok:true,data:awsGuidedResponseSchema.parse(await service.list(s))});
 }catch(error){if(error instanceof AwsEnrollmentError&&error.code==='cloud_account_limit_reached')return reply({ok:false,error:'cloud_account_limit_reached',retryAllowed:false},403);return reply({ok:false,error:'aws_guided_unavailable',message:'Reload saved connection status. Automatic setup requires an approved policy, template and account choice.'},409)}}
export async function handleAwsGuidedCallback(request:NextRequest,service=createAwsGuidedRuntime()){
 try{
  if(request.method!=='POST'||request.nextUrl.search||!request.body||request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply({ok:false,error:'invalid_request'},400);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]),bytes=await readBoundedGithubBody(new Response(request.body),signal,16384);
  const input=z.object({flowId:z.string().regex(/^aws_flow_[a-f0-9]{64}$/),proof:z.object({signedIdentityRequest:z.string().min(1).max(8192),stackId:z.string().min(1).max(512),region:z.string().min(1).max(32)}).strict()}).strict().parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  await service.callback(input.flowId,input.proof,signal);
  return reply({ok:true,status:'callback_processed'});
 }catch{return reply({ok:false,error:'aws_guided_callback_refused'},409)}
}
