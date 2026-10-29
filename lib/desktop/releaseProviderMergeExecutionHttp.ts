import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {consumeToken} from '@/lib/api/rateLimiter';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {withGithubAbort,readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {RELEASE_PROVIDER_MERGE_KIND} from '@/lib/tauri/releaseProviderMergeKind';
import {createReleaseProviderMergeStore,type ProviderMergeScope} from '@/lib/tauri/releaseProviderMergeStore';
import {parseProviderMergeExecutionState} from '@/lib/tauri/releaseProviderMergeExecutionContract';
import {createReleaseProviderMergeCoordinator,type ProviderMergeCoordinatorPorts} from './releaseProviderMergeCoordinator';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
const actionSchema=z.object({action:z.enum(['prepare','execute','cancel']),expectedVersion:z.number().int().min(0).max(2),clientRequestId:z.string().uuid()}).strict();
class Refusal extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
/** Default composition has no credential/policy adapters. A flag cannot activate writes. */
export async function handleReleaseProviderMergeExecution(request:NextRequest,requestId:string,planId:string,ports:ProviderMergeCoordinatorPorts={}){try{
 if(!['GET','POST'].includes(request.method))throw new Refusal('method_not_allowed',405);
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||request.nextUrl.searchParams.size||request.url.length>2048)throw new Refusal('invalid_provider_execution',400);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]),mutation=request.method==='POST';
 const principal=async()=>{signal.throwIfAborted();const p=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:mutation?'pipeline:trigger':'pipeline:read',requiredCapability:mutation?'deploy:execute':'github:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'release provider merge execution'}),signal);if(!p||p.credentialKind!=='desktop_session'||!p.id||!p.organizationId||!p.userId||!p.capabilities.includes('github:read')||mutation&&!p.capabilities.includes('deploy:execute'))throw new Refusal('provider_execution_permission_required',403);return p};
 const actor=await principal(),scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id};
 if(!consumeToken(`release-provider-execution:${scope.organizationId}:${scope.actorUserId}`,{capacity:8,tokensPerSecond:0.1}).allowed)throw new Refusal('provider_execution_rate_limited',429);
 const assertCurrent=async(_tx:unknown,current:ProviderMergeScope)=>{if(sha256ContentHash(scope)!==sha256ContentHash(current))throw new Refusal('provider_execution_identity_changed',403);const p=await principal();if(p.id!==scope.sessionId||p.userId!==scope.actorUserId||p.organizationId!==scope.organizationId)throw new Refusal('provider_execution_identity_changed',403)};
 const plan=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}}),signal);
 if(!plan)throw new Refusal('provider_execution_refresh_required',409);const input=parseReleaseOperationPlanInput(plan.inputJson);
 if(input.plan.organizationId!==scope.organizationId||input.plan.requestId!==requestId||input.planDigest!==sha256ContentHash(input.plan))throw new Refusal('provider_execution_refresh_required',409);
 const operationId='release_merge_provider_'+sha256ContentHash({organizationId:scope.organizationId,planId});
 const row=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:operationId,organizationId:scope.organizationId,workflowKind:RELEASE_PROVIDER_MERGE_KIND}}),signal);
 if(row){const binding=row.inputJson;if(!binding||typeof binding!=='object'||Array.isArray(binding)||!('planId' in binding)||binding.planId!==planId||!('planInput' in binding)||sha256ContentHash(binding.planInput)!==sha256ContentHash(plan.inputJson))throw new Refusal('provider_execution_refresh_required',409)}
 const repo=prisma as unknown as ReleaseOperationPlanRepo,store=createReleaseProviderMergeStore(repo,{assertCurrent}),coordinator=createReleaseProviderMergeCoordinator(repo,request,ports,{id:scope.sessionId,userId:scope.actorUserId,organizationId:scope.organizationId});
 let operation=row?await withGithubAbort(store.get(scope,operationId),signal):null;
 const available=(ports.isPlanAllowed?.(input.plan)??true)&&await coordinator.available();
 if(mutation){if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)throw new Refusal('invalid_provider_execution',400);const bytes=await readBoundedGithubBody(new Response(request.body),signal,1024),action=actionSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  if(action.expectedVersion!==0||operation&&(operation.version!==action.expectedVersion||operation.state!=='prepared'))throw new Refusal('provider_execution_refresh_required',409);
  if(action.action!=='cancel'&&!available)throw new Refusal('provider_execution_adapters_unavailable',503);
  await assertCurrent(undefined,scope);
  if(action.action==='prepare'){operation=await coordinator.prepare(planId)}
  else{if(!operation)throw new Refusal('provider_execution_refresh_required',409);operation=action.action==='execute'?await coordinator.run(operationId):await coordinator.cancel(operationId)}
 }
 await assertCurrent(undefined,scope);return reply({ok:true,data:parseProviderMergeExecutionState({available,sourcePolicy:'expected_head_observed_base',operation})});
 }catch(e){const code=e instanceof Refusal?e.code:e instanceof z.ZodError||e instanceof SyntaxError?'invalid_provider_execution':'provider_execution_refresh_required';return reply({ok:false,error:code},e instanceof Refusal?e.status:code==='invalid_provider_execution'?400:409)}}
