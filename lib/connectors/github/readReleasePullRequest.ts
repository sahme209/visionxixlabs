import 'server-only';
import {prisma} from '@/lib/db';
import {releaseMergeObservationSchema} from '@/lib/tauri/releaseMergePlan';
import {parseRepositoryFullName,resolveTenantScopedToken} from './resolveTenantScopedToken';
import {readBoundedGithubBody,withGithubAbort} from './boundedGithubRead';

const unavailable=()=>({ok:false as const,error:'release_pull_request_unavailable' as const});
/** Internal, read-only merge-plan evidence. Never exposes a token or grants merge authority.
 * A route must additionally require a current paired actor capability and a stored release target.
 */
export async function readReleasePullRequest(input:{organizationId:string;repositoryFullName:string;pullRequestNumber:number;signal:AbortSignal}){
 try{
  const {organizationId,repositoryFullName,pullRequestNumber}=input;
  if(!organizationId||organizationId!==organizationId.trim()||organizationId.length>240||!Number.isSafeInteger(pullRequestNumber)||pullRequestNumber<1||input.signal.aborted)return unavailable();
  const repository=parseRepositoryFullName(repositoryFullName);if(!repository)return unavailable();
  const signal=AbortSignal.any([input.signal,AbortSignal.timeout(15_000)]);
  const lookup=()=>prisma.gitHubInstallation.findFirst({where:{organizationId,status:'active'},orderBy:{installedAt:'desc' as const},select:{id:true,githubInstallationId:true,updatedAt:true,revokedAt:true,suspendedAt:true}});
  const installation=await withGithubAbort(lookup(),signal);
  if(!installation||installation.revokedAt||installation.suspendedAt)return unavailable();
  const pinned={id:installation.id,githubInstallationId:installation.githubInstallationId,updatedAt:new Date(installation.updatedAt),signal,permissionProfile:'pull_requests_read' as const};
  if(!pinned.id||!pinned.githubInstallationId||!Number.isFinite(pinned.updatedAt.getTime()))return unavailable();
  const revision=pinned.updatedAt.toISOString();
  const token=await withGithubAbort(resolveTenantScopedToken(organizationId,repository,pinned),signal);
  if(!token.ok||signal.aborted)return unavailable();
  const url=`https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/pulls/${pullRequestNumber}`;
  const response=await withGithubAbort(fetch(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{accept:'application/vnd.github+json',authorization:`Bearer ${token.token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'axiom-agent/1.0'}}),signal);
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readBoundedGithubBody(response,signal,256*1024)));
  if(!body||body.number!==pullRequestNumber||body.html_url!==`https://github.com/${repositoryFullName}/pull/${pullRequestNumber}`||body.base?.repo?.full_name!==repositoryFullName)return unavailable();
  const observation=releaseMergeObservationSchema.safeParse({connectionId:pinned.id,connectionRevision:revision,repositoryFullName,number:body.number,headRepositoryFullName:body.head?.repo?.full_name,headRef:body.head?.ref,headSha:body.head?.sha,baseRef:body.base?.ref,baseSha:body.base?.sha,state:body.state,draft:body.draft,merged:body.merged});
  if(!observation.success||observation.data.headRepositoryFullName!==repositoryFullName)return unavailable();
  const current=await withGithubAbort(lookup(),signal);
  if(signal.aborted||!current||current.id!==pinned.id||current.githubInstallationId!==pinned.githubInstallationId||current.updatedAt.getTime()!==pinned.updatedAt.getTime()||current.revokedAt||current.suspendedAt)return unavailable();
  return {ok:true as const,observation:observation.data};
 }catch{return unavailable()}
}
