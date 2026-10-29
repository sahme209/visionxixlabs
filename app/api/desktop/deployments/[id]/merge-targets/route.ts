import {NextResponse,type NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {parseGithubRepositoryUrl,parseGithubPullRequestUrl} from '@/lib/connectors/github/releaseEvidence';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
import {validateIntake} from '@/lib/tauri/deploymentOperations';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
/** Narrow stored-target catalogue, never the private full intake or an execution grant. */
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}):Promise<Response>{
 try{
  const session=await resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:'workspace:read',route:'GET /api/desktop/deployments/:id/merge-targets',allowApiKey:false});
  if(!session)return reply({ok:false,error:'desktop_session_required'},401);
  const query=request.nextUrl.searchParams,version=query.get('expectedVersion')??'',{id}=await context.params;
  if(request.url.length>2048||query.getAll('expectedVersion').length!==1||[...query.keys()].some(key=>key!=='expectedVersion')||!/^\d{1,9}$/.test(version)||Number(version)<1||!id||id.length>160||id!==id.trim()||/[\0\r\n]/.test(id))return reply({ok:false,error:'invalid_release_version'},400);
  const organizationId=String(session.organizationId);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]);
  const row=await withGithubAbort(prisma.tauriDeploymentRequest.findFirst({where:{organizationId,id}}),signal);
  const refuse=()=>reply({ok:false,error:'release_merge_targets_unavailable'},409);
  if(!row||row.id!==id||row.organizationId!==organizationId||row.version!==Number(version)||row.status!=='submitted')return refuse();
  const result=parseDeploymentIntake(row.intakeJson);if(!result.ok)return refuse();
  const intake=result.intake;
  if(intake.id!==id||intake.tenantId!==organizationId||validateIntake(intake).length||intake.noPrRequired||intake.repositoryUrls.length!==1||intake.productionPrUrls.length<1||intake.productionPrUrls.length>25)return refuse();
  const repository=parseGithubRepositoryUrl(intake.repositoryUrls[0]);if(!repository)return refuse();
  const repositoryFullName=`${repository.owner}/${repository.repository}`;
  const targets:Array<{number:number;url:string}>=[];
  for(const url of intake.productionPrUrls){
   const pr=parseGithubPullRequestUrl(url);
   if(!pr||`${pr.owner}/${pr.repository}`!==repositoryFullName||url!==`https://github.com/${repositoryFullName}/pull/${pr.number}`||targets.some(target=>target.number===pr.number))return refuse();
   targets.push({number:pr.number,url});
  }
  if(signal.aborted)return refuse();
  return reply({ok:true,data:{requestId:id,requestVersion:row.version,repositoryFullName,targets}});
 }catch{return reply({ok:false,error:'release_merge_targets_unavailable'},502)}
}
