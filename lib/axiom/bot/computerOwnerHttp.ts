import {assertNoUncoveredGovernanceExecution} from '@/lib/governance/intelligence/uncoveredExecution';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import 'server-only';
import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {consumeToken} from '@/lib/api/rateLimiter';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {getSavedBotTask,type SavedBotTaskRepo} from './savedTaskRepo';
const input=z.object({nonce:z.string().regex(/^[a-f0-9]{64}$/),taskVersion:z.number().int().min(0).max(2147483647),action:z.enum(['textedit_set_text','textedit_read_outcome'])}).strict();
const options={requiredScope:'pipeline:read' as const,requiredCapability:'workspace:read' as const,requireWorkspaceMembership:true,allowApiKey:false,route:'Bot native owner verification'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
/** Short-lived identity/task attestation only. This does not approve OS access or input. */
export async function handleBotComputerOwner(request:NextRequest,taskId:string){
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 if(process.env.AXIOM_BOT_COMPUTER_INPUT_ENABLED!=='true')return reply({ok:false,error:'bot_computer_unavailable'},503);
 const signal=AbortSignal.any([request.signal,AbortSignal.timeout(5000)]);
 try{
  if(!/^bot_[a-f0-9]{64}$/.test(taskId)||[...request.nextUrl.searchParams].length||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)return reply({ok:false,error:'bot_computer_input_invalid'},400);
  const auth=async()=>{if(process.env.AXIOM_BOT_COMPUTER_INPUT_ENABLED!=='true')throw Error('disabled');signal.throwIfAborted();const p=await withGithubAbort(resolveRequestDesktopSession(request,options),signal);signal.throwIfAborted();if(!p||p.credentialKind!=='desktop_session'||!p.id||!p.userId||!p.organizationId)throw Error('owner_required');return p};
  const p=await auth();
  if(!consumeToken(`bot-computer-owner:${p.organizationId}:${p.userId}`,{capacity:12,tokensPerSecond:0.5}).allowed)return reply({ok:false,error:'bot_computer_rate_limited'},429);
  const bytes=await readBoundedGithubBody(new Response(request.body),signal,1024);const parsed=input.safeParse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  if(!parsed.success)return reply({ok:false,error:'bot_computer_input_invalid'},400);
  const scope={organizationId:p.organizationId,userId:p.userId},task=await withGithubAbort(getSavedBotTask(prisma as unknown as SavedBotTaskRepo,scope,taskId),signal);
  if(!task)return reply({ok:false,error:'bot_task_not_found'},404);
  if(task.version!==parsed.data.taskVersion)return reply({ok:false,error:'bot_task_changed'},409);
  const current=await auth();if(current.id!==p.id||current.userId!==p.userId||current.organizationId!==p.organizationId)throw Error('owner_required');
  const latest=await withGithubAbort(getSavedBotTask(prisma as unknown as SavedBotTaskRepo,scope,taskId),signal);if(!latest||latest.version!==task.version||latest.contentHash!==task.contentHash)return reply({ok:false,error:'bot_task_changed'},409);
  if(parsed.data.action==='textedit_set_text')await assertNoUncoveredGovernanceExecution(request,prisma as unknown as ReleaseOperationPlanRepo,{organizationId:p.organizationId,actorUserId:p.userId,sessionId:p.id},signal);
  const final=await auth();if(final.id!==p.id||final.userId!==p.userId||final.organizationId!==p.organizationId)throw Error('owner_required');signal.throwIfAborted();if(process.env.AXIOM_BOT_COMPUTER_INPUT_ENABLED!=='true')throw Error('disabled');return reply({ok:true,data:{kind:'bot_computer_owner_v1',organizationId:p.organizationId,userId:p.userId,sessionId:p.id,taskId,taskVersion:task.version,action:parsed.data.action,nonce:parsed.data.nonce,expiresAt:new Date(Date.now()+15000).toISOString()}});
 }catch{return reply({ok:false,error:'bot_computer_owner_unavailable'},503)}
}
