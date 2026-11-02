import {ReleaseVerificationFailure} from './releaseVerificationPhase';
import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {consumeToken} from '@/lib/api/rateLimiter';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {createReleaseDeploymentServices} from './releaseDeploymentServices';
import {releaseDeploymentApprovalPreviewSchema} from '@/lib/tauri/releaseDeploymentApprovalContract';
import {deploymentPlanSchema,type DeploymentScope} from '@/lib/tauri/releaseDeploymentExecutionContract';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
const input=z.object({plan:deploymentPlanSchema,clientRequestId:z.string().uuid(),reviewedExactAction:z.literal(true),governanceBaselineDigest:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict();
type Services=Pick<ReturnType<typeof createReleaseDeploymentServices>,'ports'|'issueIndependentApproval'|'previewIndependentApproval'>;
type Factory=(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:DeploymentScope)=>Services;
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
/** Exact human review boundary. Default service activation is false; no dispatch lives here. */
export async function handleReleaseDeploymentApproval(request:NextRequest,releaseId:string,planId:string,factory:Factory=(r,repo,s)=>createReleaseDeploymentServices(r,repo,s)){
 try{
  if(!['GET','POST'].includes(request.method))return reply({ok:false,error:'method_not_allowed'},405);
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(releaseId)||!/^release_plan_[a-f0-9]{64}$/.test(planId)||request.nextUrl.searchParams.size||request.url.length>2048||request.method==='POST'&&(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body))return reply({ok:false,error:'invalid_deployment_approval'},400);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25000)]);
  const principal=()=>withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'agent:approve',requireWorkspaceMembership:true,allowApiKey:false,recordHeartbeat:false,route:'release deployment exact approval'}),signal);
  const actor=await principal();if(!actor||actor.credentialKind!=='desktop_session'||!actor.capabilities.includes('agent:approve')||!actor.capabilities.includes('github:read'))return reply({ok:false,error:'deployment_approval_permission_required'},403);
  if(!consumeToken(`release-deployment-approval:${actor.organizationId}:${actor.userId}`,{capacity:6,tokensPerSecond:0.1}).allowed)return reply({ok:false,error:'deployment_approval_rate_limited'},429);
  const scope={organizationId:actor.organizationId,actorUserId:actor.userId,sessionId:actor.id},services=factory(request,prisma as unknown as ReleaseOperationPlanRepo,scope);
  if(!services.ports.enabled?.())return reply({ok:false,error:'deployment_approvals_unavailable'},503);
  if(request.method==='GET'){
   const rawPreview=await withGithubAbort(services.previewIndependentApproval(planId),signal);
   const parsedPreview=releaseDeploymentApprovalPreviewSchema.safeParse(rawPreview);if(!parsedPreview.success)return reply({ok:false,error:'deployment_approval_refresh_required'},409);const preview=parsedPreview.data;
   if(preview.plan.releaseId!==releaseId||preview.plan.planId!==planId||preview.plan.organizationId!==actor.organizationId)return reply({ok:false,error:'deployment_approval_binding_required'},409);
   const current=await principal();if(!current||current.id!==actor.id||current.userId!==actor.userId||current.organizationId!==actor.organizationId||!services.ports.enabled?.())return reply({ok:false,error:'deployment_approval_refresh_required'},409);
   return reply({ok:true,data:preview},200);
  }
  const bytes=await readBoundedGithubBody(new Response(request.body!),signal,24576),body=input.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))),p=body.plan;
  if(p.releaseId!==releaseId||p.planId!==planId||p.organizationId!==actor.organizationId||[p.creatorUserId,p.requesterUserId,p.executorUserId].includes(actor.userId))return reply({ok:false,error:'deployment_approval_binding_required'},409);
  const approval=await withGithubAbort(body.governanceBaselineDigest===undefined?services.issueIndependentApproval(p,body.clientRequestId):services.issueIndependentApproval(p,body.clientRequestId,body.governanceBaselineDigest),signal);
  const current=await principal();if(!current||current.id!==actor.id||current.userId!==actor.userId||current.organizationId!==actor.organizationId||!current.capabilities.includes('agent:approve')||!services.ports.enabled?.())return reply({ok:false,error:'deployment_approval_refresh_required'},409);
  return reply({ok:true,data:{approval,executionAvailable:false}},201);
 }catch(error){if(error instanceof ReleaseVerificationFailure)return reply({ok:false,error:error.code},409);return reply({ok:false,error:error instanceof z.ZodError||error instanceof SyntaxError?'invalid_deployment_approval':'deployment_approval_refresh_required'},error instanceof z.ZodError||error instanceof SyntaxError?400:409)}
}
