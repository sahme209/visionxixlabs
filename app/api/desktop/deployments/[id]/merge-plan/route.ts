import {NextResponse,type NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {readReleasePullRequest} from '@/lib/connectors/github/readReleasePullRequest';
import {parseGithubRepositoryUrl} from '@/lib/connectors/github/releaseEvidence';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
import {validateIntake} from '@/lib/tauri/deploymentOperations';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {buildReleaseMergePlan} from '@/lib/tauri/releaseMergePlan';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
const policy={requiredScope:'pipeline:read' as const,requiredCapability:'github:read' as const,route:'GET /api/desktop/deployments/:id/merge-plan',allowApiKey:false};
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});

/** Read-only plan preview: zero approval records, writes, scheduling or provider execution. */
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}):Promise<Response>{
 try{
  const session=await resolveRequestDesktopSession(request,policy);if(!session)return reply({ok:false,error:'desktop_session_required'},401);
  const query=request.nextUrl.searchParams;
  const fields=['expectedVersion','pullRequestNumber','method'];
  const version=query.get('expectedVersion')??'',number=query.get('pullRequestNumber')??'',method=query.get('method');
  const {id}=await context.params;
  if(request.url.length>2048||!fields.every(key=>query.getAll(key).length===1)||[...query.keys()].some(key=>!fields.includes(key))||!/^\d{1,9}$/.test(version)||Number(version)<1||!/^\d{1,9}$/.test(number)||Number(number)<1||!['merge','squash','rebase'].includes(method??'')||!id||id.length>160||id!==id.trim()||/[\0\r\n]/.test(id))return reply({ok:false,error:'invalid_release_merge_plan'},400);
  const organizationId=String(session.organizationId);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25_000)]);
  const lookup=()=>prisma.tauriDeploymentRequest.findFirst({where:{organizationId,id}});
  const row=await withGithubAbort(lookup(),signal);
  if(!row||row.id!==id||row.organizationId!==organizationId||row.version!==Number(version)||row.status!=='submitted')return reply({ok:false,error:'release_merge_plan_changed'},409);
  const parsed=parseDeploymentIntake(row.intakeJson);
  if(!parsed.ok||parsed.intake.tenantId!==organizationId||parsed.intake.id!==id||validateIntake(parsed.intake).length||parsed.intake.noPrRequired||parsed.intake.repositoryUrls.length!==1)return reply({ok:false,error:'release_merge_plan_changed'},409);
  const repository=parseGithubRepositoryUrl(parsed.intake.repositoryUrls[0]);
  if(!repository)return reply({ok:false,error:'release_merge_plan_changed'},409);
  const repositoryFullName=`${repository.owner}/${repository.repository}`;
  if(!parsed.intake.productionPrUrls.includes(`https://github.com/${repositoryFullName}/pull/${Number(number)}`))return reply({ok:false,error:'release_merge_plan_changed'},409);
  const digest=sha256ContentHash({requestVersion:row.version,intake:row.intakeJson});
  const evidence=await readReleasePullRequest({organizationId,repositoryFullName,pullRequestNumber:Number(number),signal});
  if(!evidence.ok||signal.aborted)return reply({ok:false,error:'release_merge_plan_unavailable'},502);
  const result=buildReleaseMergePlan(row,{organizationId,requestId:id,expectedVersion:row.version,expectedDigest:digest,method,observation:evidence.observation});
  if(!result.ok)return reply({ok:false,error:'release_merge_plan_unavailable'},502);
  const actor=await withGithubAbort(resolveRequestDesktopSession(request,policy),signal);
  if(!actor||String(actor.organizationId)!==organizationId||actor.userId!==session.userId)return reply({ok:false,error:'desktop_session_required'},401);
  const current=await withGithubAbort(lookup(),signal);
  if(signal.aborted||!current||current.id!==id||current.organizationId!==organizationId||current.status!=='submitted'||current.version!==row.version||sha256ContentHash({requestVersion:current.version,intake:current.intakeJson})!==digest)return reply({ok:false,error:'release_merge_plan_changed'},409);
  return reply({ok:true,data:{authority:'evidence_only',plan:result.plan,digest:result.digest}});
 }catch{return reply({ok:false,error:'release_merge_plan_unavailable'},502)}
}
