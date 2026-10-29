import {releaseAcceptanceEnabled,releaseAcceptanceRequestAllowed,releaseAcceptancePlanAllowed} from './releaseAcceptanceScope';
import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z,ZodError} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession,type DesktopRequestPrincipal} from './resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {readReleaseOperationPreviewPlan} from '@/lib/tauri/readReleaseOperationPreviewPlan';
import {releaseOperationPreviewCache} from '@/lib/tauri/releaseOperationPreview';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {createReleaseOperationPlan,listReleaseOperationPlans,reviewReleaseOperationPlan,cancelReleaseOperationPlan,type ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
const db=prisma as unknown as ReleaseOperationPlanRepo;
const enabled=()=>process.env.AXIOM_RELEASE_OPERATION_PLANS_ENABLED==='true';
class Refusal extends Error {constructor(readonly status:number,readonly code:string){super(code)}}
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(error:string,status:number)=>reply({ok:false,error},status);
const version=z.number().int().min(1).max(2147483647),planVersion=z.number().int().min(0).max(2147483647),token=z.string().regex(/^rpv_[a-f0-9]{64}$/),uuid=z.string().uuid();
const createBody=z.object({expectedVersion:version,previewToken:token}).strict();
const reviewBody=z.object({expectedPlanVersion:planVersion,previewToken:token,decision:z.enum(['reviewed','rejected']),clientRequestId:uuid}).strict();
const cancelBody=z.object({expectedPlanVersion:planVersion,clientRequestId:uuid}).strict();
function id(value:string){if(!value||value.length>160||value!==value.trim()||/[\x00-\x1f\x7f]/.test(value))throw new Refusal(400,'invalid_release_operation_plan')}
function query(request:NextRequest,keys:string[]){const q=request.nextUrl.searchParams;if(request.url.length>2048||keys.some(k=>q.getAll(k).length!==1)||[...q.keys()].some(k=>!keys.includes(k)))throw new Refusal(400,'invalid_release_operation_plan');return q}
function queryVersion(v:string|null){if(!v||!/^\d{1,10}$/.test(v))throw new Refusal(400,'invalid_release_operation_plan');return version.parse(Number(v))}
async function body(request:NextRequest){
 if(!request.body||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new Refusal(400,'invalid_release_operation_plan');
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>2048))throw new Refusal(400,'invalid_release_operation_plan');
 const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined,stop!:()=>void;let bytes=0;const parts:Uint8Array[]=[];
 const stopped=new Promise<never>((_resolve,reject)=>{stop=()=>reject(new Refusal(400,'invalid_release_operation_plan'));timer=setTimeout(stop,5000)});request.signal.addEventListener('abort',stop,{once:true});
 try{request.signal.throwIfAborted();while(true){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;bytes+=part.value.byteLength;if(bytes>2048)throw new Refusal(400,'invalid_release_operation_plan');parts.push(part.value)}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)))}catch(error){if(error instanceof Refusal)throw error;throw new Refusal(400,'invalid_release_operation_plan')}finally{clearTimeout(timer);request.signal.removeEventListener('abort',stop);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
async function principal(request:NextRequest,manage:boolean,approving=false):Promise<DesktopRequestPrincipal>{
 const session=await resolveRequestDesktopSession(request,{requiredScope:manage&&!approving?'pipeline:trigger':'pipeline:read',requiredCapability:approving?'agent:approve':manage?'deploy:execute':'github:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:`${request.method} /api/desktop/deployments/:id/operation-plans`});
 if(!session||session.credentialKind!=='desktop_session')throw new Refusal(401,'desktop_session_required');
 if((manage&&!session.capabilities.includes(approving?'agent:approve':'deploy:execute'))||manage&&!session.capabilities.includes('github:read'))throw new Refusal(403,'release_plan_permission_required');return session;
}
function current(request:NextRequest,initial:DesktopRequestPrincipal,manage:boolean,flag:boolean,signal:AbortSignal,featureEnabled:()=>boolean=enabled,approving=false){return async()=>{signal.throwIfAborted();if(flag&&!featureEnabled())throw new Refusal(409,'release_operation_plans_disabled');const actor=await withGithubAbort(principal(request,manage,approving),signal);if(actor.id!==initial.id||actor.userId!==initial.userId||actor.organizationId!==initial.organizationId)throw new Refusal(401,'desktop_session_required');if(flag&&!featureEnabled())throw new Refusal(409,'release_operation_plans_disabled');signal.throwIfAborted()}}
async function requestFeature(actor:DesktopRequestPrincipal,requestId:string){const accepted=await releaseAcceptanceRequestAllowed(prisma as unknown as Parameters<typeof releaseAcceptanceRequestAllowed>[0],String(actor.organizationId),requestId);return()=>enabled()||accepted&&releaseAcceptanceEnabled(String(actor.organizationId))}
function assertPlanScope(plan:{organizationId:string;pullRequest:{repositoryFullName:string}}){if(!enabled()&&!releaseAcceptancePlanAllowed({organizationId:plan.organizationId,repositoryFullName:plan.pullRequest.repositoryFullName}))throw new Refusal(409,'release_operation_plans_disabled')}
function rate(actor:DesktopRequestPrincipal,operation:string){if(!consumeToken(`release-plan:${operation}:${actor.organizationId}:${actor.userId}`,{capacity:10,tokensPerSecond:0.2}).allowed)throw new Refusal(429,'release_plan_rate_limited')}
const scope=(actor:DesktopRequestPrincipal,requestId:string,requestVersion:number)=>({organizationId:String(actor.organizationId),userId:String(actor.userId),sessionId:String(actor.id),requestId,requestVersion});
async function release(requestId:string,organizationId:string,signal:AbortSignal){const row=await withGithubAbort(prisma.tauriDeploymentRequest.findFirst({where:{id:requestId,organizationId}}),signal);if(!row||row.id!==requestId||row.organizationId!==organizationId)throw new Refusal(409,'release_plan_changed');return row}
function failure(error:unknown){if(error instanceof Refusal)return fail(error.code,error.status);if(error instanceof Error&&error.message==='release_plan_window_expired')return fail('release_plan_window_expired',409);if(error instanceof ZodError||error instanceof SyntaxError)return fail('invalid_release_operation_plan',400);return fail('release_plan_refresh_required',409)}
export async function handleReleaseOperationPlanPreview(request:NextRequest,requestId:string){try{
 id(requestId);if(request.method!=='GET')return fail('method_not_allowed',405);const actor=await principal(request,false);const featureEnabled=await requestFeature(actor,requestId);rate(actor,'preview');if(!featureEnabled())throw new Refusal(409,'release_operation_plans_disabled');
 const q=query(request,['expectedVersion','pullRequestNumber','method']),expectedVersion=queryVersion(q.get('expectedVersion')),pullRequestNumber=queryVersion(q.get('pullRequestNumber')),method=z.enum(['merge','squash','rebase']).parse(q.get('method'));
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);const assertCurrent=current(request,actor,false,true,signal,featureEnabled);
 const plan=await readReleaseOperationPreviewPlan({organizationId:String(actor.organizationId),requestId,expectedVersion,pullRequestNumber,method,signal});assertPlanScope(plan);await assertCurrent();
 return reply({ok:true,data:releaseOperationPreviewCache.issue(scope(actor,requestId,expectedVersion),plan)});
 }catch(error){return failure(error)}}
export async function handleReleaseOperationPlans(request:NextRequest,requestId:string){try{
 id(requestId);const manage=request.method==='POST';if(!['GET','POST'].includes(request.method))return fail('method_not_allowed',405);const actor=await principal(request,manage);const featureEnabled=await requestFeature(actor,requestId);rate(actor,manage?'save':'list');const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);const assertCurrent=current(request,actor,manage,manage,signal,featureEnabled);
 if(manage){query(request,[]);if(!featureEnabled())throw new Refusal(409,'release_operation_plans_disabled');const input=createBody.parse(await body(request));const preview=releaseOperationPreviewCache.consume(scope(actor,requestId,input.expectedVersion),input.previewToken);assertPlanScope(preview.plan);const plan=await withGithubAbort(createReleaseOperationPlan(db,{organizationId:String(actor.organizationId),actorUserId:String(actor.userId),plan:preview.plan,planDigest:preview.digest,assertCurrent}),signal);await assertCurrent();return reply({ok:true,data:{enabled:featureEnabled(),plan}},201)}
 const q=query(request,['expectedVersion']),expectedVersion=queryVersion(q.get('expectedVersion'));const row=await release(requestId,String(actor.organizationId),signal);if(row.version!==expectedVersion)throw new Refusal(409,'release_plan_changed');
 const canManage=actor.capabilities.includes('deploy:execute'),canReview=actor.capabilities.includes('agent:approve');const list=await withGithubAbort(listReleaseOperationPlans(db,{organizationId:String(actor.organizationId),actorUserId:String(actor.userId),requestId,canManage:canManage||canReview,assertCurrent}),signal);await assertCurrent();const finalActor=await withGithubAbort(principal(request,false),signal);if(finalActor.id!==actor.id||finalActor.userId!==actor.userId||finalActor.organizationId!==actor.organizationId)throw new Refusal(401,'desktop_session_required');const finalCanManage=canManage&&finalActor.capabilities.includes('deploy:execute'),finalCanReview=canReview&&finalActor.capabilities.includes('agent:approve');return reply({ok:true,data:{enabled:featureEnabled(),...list,plans:list.plans.map(plan=>({...plan,canReview:featureEnabled()&&finalCanReview&&plan.canReview&&(enabled()||releaseAcceptancePlanAllowed({organizationId:plan.plan.organizationId,repositoryFullName:plan.plan.pullRequest.repositoryFullName})),canCancel:finalCanManage&&plan.canCancel})),canManage:featureEnabled()&&finalCanManage}});
 }catch(error){return failure(error)}}
export async function handleReleaseOperationPlanMutation(request:NextRequest,requestId:string,planId:string,review=false){try{
 id(requestId);if(!/^release_plan_[a-f0-9]{64}$/.test(planId))throw new Refusal(400,'invalid_release_operation_plan');if(request.method!==(review?'POST':'DELETE'))return fail('method_not_allowed',405);query(request,[]);
 const actor=await principal(request,true,review);const featureEnabled=await requestFeature(actor,requestId);rate(actor,review?'review':'cancel');const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]),assertCurrent=current(request,actor,true,review,signal,featureEnabled,review);if(review&&!featureEnabled())throw new Refusal(409,'release_operation_plans_disabled');
 const binding=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:planId,organizationId:String(actor.organizationId),workflowKind:RELEASE_OPERATION_PLAN_KIND}}),signal);if(!binding||parseReleaseOperationPlanInput(binding.inputJson).plan.requestId!==requestId)throw new Refusal(409,'release_plan_changed');
 const input=review?reviewBody.parse(await body(request)):cancelBody.parse(await body(request));const base={organizationId:String(actor.organizationId),actorUserId:String(actor.userId),id:planId,expectedVersion:input.expectedPlanVersion,clientRequestId:input.clientRequestId,assertCurrent};
 let plan;
 if(review){const reviewed=reviewBody.parse(input);const row=await release(requestId,String(actor.organizationId),signal);const preview=releaseOperationPreviewCache.consume(scope(actor,requestId,row.version),reviewed.previewToken);assertPlanScope(preview.plan);plan=await withGithubAbort(reviewReleaseOperationPlan(db,{...base,decision:reviewed.decision,currentPlan:preview.plan,currentPlanDigest:preview.digest}),signal)}else plan=await withGithubAbort(cancelReleaseOperationPlan(db,base),signal);
 await assertCurrent();return reply({ok:true,data:{enabled:featureEnabled(),plan}});
 }catch(error){return failure(error)}}
