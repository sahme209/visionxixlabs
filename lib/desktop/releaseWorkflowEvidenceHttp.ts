import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';import {z} from 'zod';
import {prisma} from '@/lib/db';import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';import {consumeToken} from '@/lib/api/rateLimiter';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';import {parseReleaseOperationPlanInput,RELEASE_OPERATION_PLAN_KIND,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {createReleaseWorkflowEvidenceStore,type ReleaseWorkflowEvidenceDependencies,type ReleaseWorkflowEvidenceScope} from '@/lib/tauri/releaseWorkflowEvidenceStore';
import {parseReleaseWorkflowEvidenceResponse,RELEASE_WORKFLOW_EVIDENCE_KIND,releaseWorkflowEvidenceBindingSchema,type ReleaseWorkflowEvidenceBinding,type ReleaseWorkflowEvidenceDto} from '@/lib/tauri/releaseWorkflowEvidenceContract';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
const mutation=z.union([z.object({action:z.literal('collect')}).strict(),z.object({action:z.enum(['reconcile','cancel']),id:z.string().regex(/^release_workflow_evidence_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(0).max(8)}).strict()]);
class Refusal extends Error{constructor(readonly code:string,readonly status:number){super(code)}}
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export interface ReleaseWorkflowEvidenceHttpPorts extends Pick<ReleaseWorkflowEvidenceDependencies,'readCurrentBinding'|'verifyObservation'>{enabled?:()=>boolean;preflight?:(planId:string,signal:AbortSignal)=>Promise<void>;collectAcceptedBinding?:(scope:ReleaseWorkflowEvidenceScope,planId:string,signal:AbortSignal)=>Promise<unknown>}
/** The default handler reads history only. The explicit route composition may
 * collect/reconcile an accepted run; this handler has no dispatch transport. */
export type ReleaseWorkflowEvidenceServiceFactory=(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:ReleaseWorkflowEvidenceScope,plan:ReleaseOperationPlan,requesterUserId:string)=>ReleaseWorkflowEvidenceHttpPorts;
export function createReleaseWorkflowEvidenceHttp(supplied:ReleaseWorkflowEvidenceHttpPorts|ReleaseWorkflowEvidenceServiceFactory={}){
 return async function handle(request:NextRequest,requestId:string,planId:string){
  const started=performance.now();let phase:'request'|'authority'|'plan'|'source_preflight'|'accepted_binding'|'saved_history'|'persist_binding'|'observe'|'cancel'|'response'='request';
  try{
  if(!['GET','POST'].includes(request.method))throw new Refusal('method_not_allowed',405);
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(requestId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||request.nextUrl.searchParams.size||request.url.length>2048)throw new Refusal('invalid_workflow_evidence',400);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  const principal=async()=>{signal.throwIfAborted();const p=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'github:read',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'release workflow evidence history/reconciliation'}),signal);if(!p||p.credentialKind!=='desktop_session'||!p.id||!p.userId||!p.organizationId)throw new Refusal('desktop_session_required',401);if(!p.capabilities.includes('github:read'))throw new Refusal('workflow_evidence_permission_required',403);return p};
  phase='authority';const actor=await principal(),scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id};
  if(!consumeToken(`release-workflow-evidence:${actor.organizationId}:${actor.userId}`,{capacity:12,tokensPerSecond:0.2}).allowed)throw new Refusal('workflow_evidence_rate_limited',429);
  let ports:ReleaseWorkflowEvidenceHttpPorts=typeof supplied==='function'?{}:supplied;
  const available=()=>Boolean((ports.enabled?.()??process.env.AXIOM_RELEASE_WORKFLOW_EVIDENCE_ENABLED==='true')&&ports.readCurrentBinding&&ports.verifyObservation);
  const assertCurrent=async(_tx:unknown,s:ReleaseWorkflowEvidenceScope)=>{signal.throwIfAborted();if(sha256ContentHash(s)!==sha256ContentHash(scope))throw new Refusal('desktop_session_required',401);const p=await principal();if(p.id!==actor.id||p.organizationId!==actor.organizationId||p.userId!==actor.userId)throw new Refusal('desktop_session_required',401)};
  let input:z.infer<typeof mutation>|undefined;
  if(request.method==='POST'){if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)throw new Refusal('invalid_workflow_evidence',400);try{input=mutation.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(new Response(request.body),signal,512))))}catch(error){if(signal.aborted)throw error;throw new Refusal('invalid_workflow_evidence',400)}}
  phase='plan';const row=await withGithubAbort(prisma.durableAgentWorkflow.findFirst({where:{id:planId,organizationId:scope.organizationId,workflowKind:RELEASE_OPERATION_PLAN_KIND}}),signal);
  if(!row)throw new Refusal('workflow_evidence_refresh_required',409);const stored=parseReleaseOperationPlanInput(row.inputJson);
  if(stored.plan.organizationId!==scope.organizationId||stored.plan.requestId!==requestId||stored.planDigest!==sha256ContentHash(stored.plan))throw new Refusal('workflow_evidence_refresh_required',409);
  const repo=prisma as unknown as ReleaseOperationPlanRepo;ports=typeof supplied==='function'?supplied(request,repo,scope,stored.plan,stored.releaseRequesterUserId):supplied;
  if(input&&input.action!=='cancel'&&!available())throw new Refusal('trusted_verifier_unavailable',503);
  if(input?.action==='reconcile'){phase='source_preflight';await ports.preflight?.(planId,signal);}
  const validateBinding=(b:ReleaseWorkflowEvidenceBinding)=>{if(b.organizationId!==scope.organizationId||b.releaseId!==requestId||b.releaseVersion!==stored.plan.requestVersion||b.intakeDigest!==stored.plan.intakeDigest||b.planId!==planId||b.planDigest!==stored.planDigest||b.connectionId!==stored.plan.connectionId||b.connectionRevision!==stored.plan.connectionRevision||b.repositoryFullName!==stored.plan.pullRequest.repositoryFullName)throw new Refusal('workflow_evidence_refresh_required',409);return b};
  const validate=(dto:ReleaseWorkflowEvidenceDto)=>{validateBinding(dto.binding);return dto};
  const store=createReleaseWorkflowEvidenceStore(prisma as unknown as ReleaseOperationPlanRepo,{assertCurrent,readCurrentBinding:ports.readCurrentBinding?async(tx,s,b)=>{if(!available())throw new Refusal('trusted_verifier_unavailable',503);const fresh=await ports.readCurrentBinding!(tx,s,b);await assertCurrent(tx,s);if(!available())throw new Refusal('trusted_verifier_unavailable',503);return fresh}:undefined,verifyObservation:ports.verifyObservation?async(b,s)=>{if(!available())throw new Refusal('trusted_verifier_unavailable',503);return ports.verifyObservation!(b,s)}:undefined});
  let evidence:ReleaseWorkflowEvidenceDto[]=[],truncated=false;
  if(input?.action==='collect'){
   if(!ports.collectAcceptedBinding)throw new Refusal('trusted_verifier_unavailable',503);
   phase='accepted_binding';const binding=validateBinding(releaseWorkflowEvidenceBindingSchema.parse(await withGithubAbort(ports.collectAcceptedBinding(scope,planId,signal),signal)));
   phase='saved_history';const candidateRows=await prisma.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,requestedByUserId:scope.actorUserId,workflowKind:RELEASE_WORKFLOW_EVIDENCE_KIND,AND:[{inputJson:{path:['scope','sessionId'],equals:scope.sessionId}},{inputJson:{path:['binding','planId'],equals:planId}}]},orderBy:[{updatedAt:'desc'},{id:'desc'}],take:6});
   let existing:ReleaseWorkflowEvidenceDto|undefined;
   for(const row of candidateRows){const item=validate(await store.get(scope,row.id));if(item.state!=='cancelled'&&Date.parse(item.binding.expiresAt)>Date.now()&&sha256ContentHash({...item.binding,expiresAt:binding.expiresAt})===sha256ContentHash(binding)){existing=item;break}}
   phase='persist_binding';const created=existing??validate(await store.create(scope,binding));
   phase='observe';
   evidence=[created.state==='observed'&&created.observation?.status==='completed'?created:validate(await withGithubAbort(store.reconcile(scope,{id:created.id,expectedVersion:created.version},signal),signal))];
  }
  else if(input){phase='saved_history';validate(await withGithubAbort(store.get(scope,input.id),signal));phase=input.action==='cancel'?'cancel':'observe';const updated=input.action==='cancel'?await withGithubAbort(store.cancel(scope,{id:input.id,expectedVersion:input.expectedVersion}),signal):await withGithubAbort(store.reconcile(scope,{id:input.id,expectedVersion:input.expectedVersion},signal),signal);evidence=[validate(updated)]}
  else{phase='saved_history';const rows=await withGithubAbort(prisma.durableAgentWorkflow.findMany({where:{organizationId:scope.organizationId,requestedByUserId:scope.actorUserId,workflowKind:RELEASE_WORKFLOW_EVIDENCE_KIND,AND:[{inputJson:{path:['scope','sessionId'],equals:scope.sessionId}},{inputJson:{path:['binding','planId'],equals:planId}}]},orderBy:[{updatedAt:'desc'},{id:'desc'}],take:6}),signal);truncated=rows.length>5;for(const item of rows.slice(0,5))evidence.push(validate(await withGithubAbort(store.get(scope,item.id),signal)))}
  phase='response';await assertCurrent(undefined,scope);const enabled=available();return reply({ok:true,data:parseReleaseWorkflowEvidenceResponse({available:enabled,unavailableReason:enabled?null:'trusted_verifier_unavailable',evidence,truncated,providerExecutionAvailable:false})});
 }catch(error){
  // Static phase and bounded timing only: never emit request IDs, URLs, payloads,
  // exception messages, user identities or credentials to deployment logs.
  console.warn('[axiom.release.evidence]',{phase,outcome:'refused',durationMs:Math.min(60000,Math.max(0,Math.round(performance.now()-started)))});
  const status=error instanceof Refusal?error.status:error instanceof z.ZodError||error instanceof SyntaxError?400:409;return reply({ok:false,error:error instanceof Refusal?error.code:status===400?'invalid_workflow_evidence':'workflow_evidence_refresh_required'},status)}};
}
export const handleReleaseWorkflowEvidence=createReleaseWorkflowEvidenceHttp();
