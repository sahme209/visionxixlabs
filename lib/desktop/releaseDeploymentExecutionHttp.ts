import {assertNoUncoveredGovernanceExecution} from '@/lib/governance/intelligence/uncoveredExecution';
import {fenceUncoveredMutationStore} from '@/lib/governance/intelligence/uncoveredMutationStore';
import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {consumeToken} from '@/lib/api/rateLimiter';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {RELEASE_DEPLOYMENT_EXECUTION_KIND,deploymentPlanSchema,parseDeploymentExecutionState,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import {createReleaseDeploymentExecutionStore,type ReleaseDeploymentDependencies} from '@/lib/tauri/releaseDeploymentExecutionStore';
import {createReleaseDeploymentExecutor,type ReleaseDeploymentTransport} from '@/lib/tauri/releaseDeploymentExecutionExecutor';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
export interface ReleaseDeploymentServicePorts{enabled?:()=>boolean;preflight?:(plan:Readonly<import('@/lib/tauri/releaseDeploymentExecutionContract').DeploymentPlan>,signal:AbortSignal)=>Promise<void>;readPlan?:(scope:DeploymentScope,reviewedPlan:ReleaseOperationPlan,signal:AbortSignal)=>Promise<unknown>;dependencies?:ReleaseDeploymentDependencies;transport?:ReleaseDeploymentTransport}
export type ReleaseDeploymentServiceFactory=(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:DeploymentScope)=>ReleaseDeploymentServicePorts;
const actionSchema=z.object({action:z.enum(['prepare','execute','cancel','recover']),expectedVersion:z.number().int().min(0).max(2),clientRequestId:z.string().uuid()}).strict();
class Refusal extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
/** No production source-policy, independent-approval or dispatch adapters are installed here. */
export async function handleReleaseDeploymentExecution(request:NextRequest,requestId:string,planId:string,supplied:ReleaseDeploymentServicePorts|ReleaseDeploymentServiceFactory={}){try{
 if(!['GET','POST'].includes(request.method))throw new Refusal('method_not_allowed',405);
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||request.nextUrl.searchParams.size||request.url.length>2048)throw new Refusal('invalid_release_deployment',400);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);let action:z.infer<typeof actionSchema>|undefined;
 if(request.method==='POST'){if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)throw new Refusal('invalid_release_deployment',400);const bytes=await readBoundedGithubBody(new Response(request.body),signal,1024);action=actionSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))}
 const manage=!!action&&action.action!=='recover';
 const principal=async()=>{signal.throwIfAborted();const p=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:manage?'pipeline:trigger':'pipeline:read',requiredCapability:manage?'deploy:execute':'github:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'release deployment execution'}),signal);if(!p||p.credentialKind!=='desktop_session'||!p.id||!p.userId||!p.organizationId||!p.capabilities.includes('github:read')||manage&&!p.capabilities.includes('deploy:execute'))throw new Refusal('release_deployment_permission_required',403);return p};
 const actor=await principal(),scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id};
 if(!consumeToken(`release-deployment:${scope.organizationId}:${scope.actorUserId}`,{capacity:8,tokensPerSecond:0.1}).allowed)throw new Refusal('release_deployment_rate_limited',429);
 const assertCurrent=async(_tx:unknown,s:DeploymentScope)=>{if(sha256ContentHash(s)!==sha256ContentHash(scope))throw new Refusal('release_deployment_identity_changed',403);const p=await principal();if(p.id!==scope.sessionId||p.userId!==scope.actorUserId||p.organizationId!==scope.organizationId)throw new Refusal('release_deployment_identity_changed',403)};
 const row=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}}),signal);if(!row)throw new Refusal('release_deployment_refresh_required',409);const original=parseReleaseOperationPlanInput(row.inputJson),plan=original.plan;
 if(plan.organizationId!==scope.organizationId||plan.requestId!==requestId||original.planDigest!==sha256ContentHash(plan))throw new Refusal('release_deployment_refresh_required',409);
 const operationId='release_deployment_'+sha256ContentHash({organizationId:scope.organizationId,releaseId:requestId,releaseVersion:plan.requestVersion,planId});
 const saved=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:operationId,organizationId:scope.organizationId,workflowKind:RELEASE_DEPLOYMENT_EXECUTION_KIND}}),signal);
 const bindingMatches=(p:ReturnType<typeof deploymentPlanSchema.parse>)=>p.organizationId===scope.organizationId&&p.releaseId===requestId&&p.releaseVersion===plan.requestVersion&&p.intakeDigest===plan.intakeDigest&&p.planId===planId&&p.repositoryFullName===plan.pullRequest.repositoryFullName&&p.connectionId===plan.connectionId&&p.connectionRevision===plan.connectionRevision;
 if(saved){const input=saved.inputJson;if(!input||typeof input!=='object'||Array.isArray(input)||!('plan'in input)||!bindingMatches(deploymentPlanSchema.parse(input.plan)))throw new Refusal('release_deployment_refresh_required',409)}
 const repo=prisma as unknown as ReleaseOperationPlanRepo,history=createReleaseDeploymentExecutionStore(repo,{assertCurrent});
 let operation=saved?await withGithubAbort(history.get(scope,operationId),signal):null;
 const ports=typeof supplied==='function'?supplied(request,repo,scope):supplied;
 const dependencies=ports.dependencies;
 const available=(ports.enabled?.()??false)&&!!ports.readPlan&&!!dependencies?.assertCurrent&&!!dependencies.readCurrentPlan&&!!dependencies.verifySupportedSourcePolicy&&!!dependencies.readIndependentApproval&&!!dependencies.consumeIndependentApproval&&ports.transport?.kind==='release_deployment_transport_v1'&&actor.capabilities.includes('deploy:execute');
 if(action){if(action.action==='prepare'||action.action==='execute'||action.action==='cancel'){if(action.expectedVersion!==0||operation&&(operation.version!==0||operation.state!=='prepared'))throw new Refusal('release_deployment_refresh_required',409)}else if(!operation||operation.version!==action.expectedVersion)throw new Refusal('release_deployment_refresh_required',409);
  await assertCurrent(undefined,scope);
  if(action.action==='recover')operation=await history.recover(scope,operationId,action.expectedVersion);
  else if(action.action==='cancel'){if(!operation)throw new Refusal('release_deployment_refresh_required',409);operation=await history.cancel(scope,operationId,action.expectedVersion)}
  else{if(!available||!dependencies)throw new Refusal('release_deployment_adapters_unavailable',503);
   const ready=()=>{signal.throwIfAborted();if(!ports.enabled?.())throw new Refusal('release_deployment_adapters_unavailable',503)};
   const rawExecution=createReleaseDeploymentExecutionStore(repo,{...dependencies,assertCurrent:async(tx,s,p,a)=>{ready();await assertCurrent(tx,s);await dependencies.assertCurrent!(tx,s,p,a);await assertCurrent(tx,s);ready()}});
   const execution=fenceUncoveredMutationStore(rawExecution,()=>assertNoUncoveredGovernanceExecution(request,repo,scope,signal));
   if(action.action==='prepare'){ready();const current=deploymentPlanSchema.parse(await withGithubAbort(ports.readPlan!(scope,plan,signal),signal));if(!bindingMatches(current))throw new Refusal('release_deployment_refresh_required',409);operation=await execution.prepare(scope,current)}
   else{if(!operation||!saved||!saved.inputJson||typeof saved.inputJson!=='object'||!('plan' in saved.inputJson))throw new Refusal('release_deployment_refresh_required',409);if(ports.preflight)await withGithubAbort(ports.preflight(deploymentPlanSchema.parse(saved.inputJson.plan),signal),signal);operation=await createReleaseDeploymentExecutor(execution,ports.transport).run(scope,operationId)}
  }
 }
 await assertCurrent(undefined,scope);return reply({ok:true,data:parseDeploymentExecutionState({available,operation})});
 }catch(e){const code=e instanceof Refusal?e.code:e instanceof z.ZodError||e instanceof SyntaxError?'invalid_release_deployment':'release_deployment_refresh_required';return reply({ok:false,error:code},e instanceof Refusal?e.status:code==='invalid_release_deployment'?400:409)}}
