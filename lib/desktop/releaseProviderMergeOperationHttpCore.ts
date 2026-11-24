import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import type {consumeToken} from '@/lib/api/rateLimiter';
import {withGithubAbort,readBoundedGithubBody} from '@/lib/connectors/github/boundedGithubRead';
import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND} from '@/lib/tauri/releaseOperationPlanContract';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createReleaseProviderMergeStore,type ProviderMergeScope} from '@/lib/tauri/releaseProviderMergeStore';
import {RELEASE_PROVIDER_MERGE_KIND} from '@/lib/tauri/releaseProviderMergeKind';
import {parseReleaseProviderMergeOperationResponse,providerMergeHistorySchema} from '@/lib/tauri/releaseProviderMergeContract';
import {releaseOperationPlanId,type ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {ResolveOptions,DesktopRequestPrincipal} from './desktopSessionResolverCore';
export interface ReleaseProviderMergeOperationHttpDependencies {
 repo:ReleaseOperationPlanRepo;
 resolveSession:(request:NextRequest,options:ResolveOptions)=>Promise<DesktopRequestPrincipal|undefined>;
 consumeToken:typeof consumeToken;
}
const recovery=z.object({action:z.literal('recover'),expectedVersion:z.number().int().min(0).max(2)}).strict();
class Refusal extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
/** History/read recovery only. No coordinator, credential adapter, approval or provider transport is imported. */
export function createReleaseProviderMergeOperationHttp(dependencies:ReleaseProviderMergeOperationHttpDependencies){
 const {repo:prisma,resolveSession:resolveRequestDesktopSession,consumeToken}=dependencies;
 return async function(request:NextRequest,requestId:string,planId:string){try{
 if(!['GET','POST'].includes(request.method))throw new Refusal('method_not_allowed',405);
 if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||request.url.length>2048)throw new Refusal('invalid_provider_operation',400);
 const params = [...request.nextUrl.searchParams.entries()];
 const historyVersion = params[0]?.[1];
 if (params.length && (request.method !== 'GET' || params.length !== 1 || params[0][0] !== 'historyVersion'
   || !historyVersion || !/^[1-9][0-9]{0,9}$/.test(historyVersion) || Number(historyVersion) > 2147483647)) {
  throw new Refusal('invalid_provider_operation',400);
 }
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(10000)]);
 const principal=async()=>{signal.throwIfAborted();const p=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'github:read',requireWorkspaceMembership:!historyVersion,allowApiKey:false,...(historyVersion?{recordHeartbeat:false}:{}),route:'release provider operation history/recovery'}),signal);if(!p||p.credentialKind!=='desktop_session'||!p.id||!p.userId||!p.organizationId)throw new Refusal('desktop_session_required',401);if(!p.capabilities.includes('github:read'))throw new Refusal('provider_operation_permission_required',403);return p};
 const actor=await principal(),scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id};
 if(!consumeToken(`release-provider-operation:${actor.organizationId}:${actor.userId}`,{capacity:15,tokensPerSecond:0.3}).allowed)throw new Refusal('provider_operation_rate_limited',429);
 let expectedVersion:number|undefined;
 if(request.method==='POST'){if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)throw new Refusal('invalid_provider_operation',400);const bytes=await readBoundedGithubBody(new Response(request.body),signal,256);expectedVersion=recovery.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))).expectedVersion}
 const assertCurrent=async(_tx:unknown,current:ProviderMergeScope)=>{if(sha256ContentHash(current)!==sha256ContentHash(scope))throw new Refusal('desktop_session_required',401);const p=await principal();if(p.id!==actor.id||p.userId!==actor.userId||p.organizationId!==actor.organizationId)throw new Refusal('desktop_session_required',401)};
 const plan=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}}),signal);
 if(!plan)throw new Refusal('provider_operation_refresh_required',409);const stored=parseReleaseOperationPlanInput(plan.inputJson);
 if(stored.plan.organizationId!==scope.organizationId||stored.plan.requestId!==requestId||stored.planDigest!==sha256ContentHash(stored.plan))throw new Refusal('provider_operation_refresh_required',409);
 const operationId='release_merge_provider_'+sha256ContentHash({organizationId:scope.organizationId,planId});
 const row=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:operationId,organizationId:scope.organizationId,workflowKind:RELEASE_PROVIDER_MERGE_KIND}}),signal);
 if(row){const input=row.inputJson;if(!input||typeof input!=='object'||Array.isArray(input)||!('planId' in input)||input.planId!==planId||!('planInput' in input)||sha256ContentHash(input.planInput)!==sha256ContentHash(plan.inputJson))throw new Refusal('provider_operation_refresh_required',409)}
 const store=createReleaseProviderMergeStore(prisma as unknown as ReleaseOperationPlanRepo,{assertCurrent});
 if (historyVersion) {
  const requestVersion = Number(historyVersion);
  if (plan.id !== planId || plan.organizationId !== scope.organizationId || plan.workflowKind !== RELEASE_OPERATION_PLAN_KIND
   || stored.plan.requestVersion !== requestVersion
   || planId !== releaseOperationPlanId(scope.organizationId, requestId, requestVersion, stored.planDigest)) {
   throw new Refusal('provider_operation_refresh_required',409);
  }
  const events = row ? await withGithubAbort(store.getHistory(scope,operationId,plan.inputJson),signal) : [];
  if (!row) {
   await withGithubAbort(prisma.$transaction(async tx => {
    const releases = await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;requesterUserId:string;intakeJson:unknown}>>`
     SELECT "id","organizationId","version","requesterUserId","intakeJson" FROM "TauriDeploymentRequest"
     WHERE "id"=${requestId} AND "organizationId"=${scope.organizationId} FOR SHARE`;
    const release = releases[0];
    if (releases.length !== 1 || release.id !== requestId || release.organizationId !== scope.organizationId || release.version !== requestVersion
     || release.requesterUserId !== stored.releaseRequesterUserId
     || sha256ContentHash({requestVersion,intake:release.intakeJson}) !== stored.plan.intakeDigest) {
     throw new Refusal('provider_operation_refresh_required',409);
    }
    await assertCurrent(tx,scope);
   }),signal);
  }
  const data = providerMergeHistorySchema.parse({requestId,requestVersion,planId,planDigest:stored.planDigest,events});
  await assertCurrent(undefined,scope);
  return reply({ok:true,data});
 }
 if(!row&&request.method==='POST')throw new Refusal('provider_operation_refresh_required',409);
 const operation=row?await withGithubAbort(request.method==='POST'?store.recover(scope,operationId,expectedVersion):store.get(scope,operationId),signal):null;
 await assertCurrent(undefined,scope);return reply({ok:true,data:parseReleaseProviderMergeOperationResponse({operation,providerExecutionAvailable:false})});
 }catch(e){const status=e instanceof Refusal?e.status:e instanceof z.ZodError||e instanceof SyntaxError?400:409;return reply({ok:false,error:e instanceof Refusal?e.code:status===400?'invalid_provider_operation':'provider_operation_refresh_required'},status)}}

}
