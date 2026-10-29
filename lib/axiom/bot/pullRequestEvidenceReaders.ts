import 'server-only';
import {prisma} from '@/lib/db';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseDeploymentIntake} from '@/lib/tauri/deploymentIntakeSchema';
import {validateIntake} from '@/lib/tauri/deploymentOperations';
import {parseGithubRepositoryUrl,parseGithubPullRequestUrl} from '@/lib/connectors/github/releaseEvidence';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {PullRequestEvidenceBinding} from './pullRequestEvidenceRepo';
import type {SavedBotTaskScope} from './savedTaskRepo';
export async function readPullRequestEvidenceBinding(scope:SavedBotTaskScope,input:{releaseId:string;expectedReleaseVersion:number;pullRequestNumber:number},signal:AbortSignal):Promise<PullRequestEvidenceBinding|null>{
 signal.throwIfAborted();
 const row=await withGithubAbort(prisma.tauriDeploymentRequest.findFirst({where:{organizationId:scope.organizationId,id:input.releaseId}}),signal);
 if(!row||row.id!==input.releaseId||row.organizationId!==scope.organizationId||row.version!==input.expectedReleaseVersion||row.status!=='submitted')return null;
 const parsed=parseDeploymentIntake(row.intakeJson);
 if(!parsed.ok||parsed.intake.id!==row.id||parsed.intake.tenantId!==scope.organizationId||validateIntake(parsed.intake).length||parsed.intake.noPrRequired||parsed.intake.repositoryUrls.length!==1)return null;
 const repository=parseGithubRepositoryUrl(parsed.intake.repositoryUrls[0]);if(!repository)return null;
 const repositoryFullName=`${repository.owner}/${repository.repository}`;
 const urls=parsed.intake.productionPrUrls;
 if(urls.length<1||urls.length>25||new Set(urls).size!==urls.length)return null;
 if(!urls.every(url=>{const pr=parseGithubPullRequestUrl(url);return pr&&`${pr.owner}/${pr.repository}`===repositoryFullName&&url===`https://github.com/${repositoryFullName}/pull/${pr.number}`}))return null;
 if(!urls.includes(`https://github.com/${repositoryFullName}/pull/${input.pullRequestNumber}`))return null;
 const connection=await withGithubAbort(prisma.gitHubInstallation.findFirst({where:{organizationId:scope.organizationId,status:'active'},orderBy:{installedAt:'desc'},select:{id:true,updatedAt:true,revokedAt:true,suspendedAt:true,githubInstallationId:true}}),signal);
 if(!connection||!connection.githubInstallationId||connection.revokedAt||connection.suspendedAt||!Number.isFinite(connection.updatedAt.getTime()))return null;
 signal.throwIfAborted();return {releaseId:row.id,releaseVersion:row.version,releaseDigest:sha256ContentHash({requestVersion:row.version,intake:row.intakeJson}),repositoryFullName,pullRequestNumber:input.pullRequestNumber,connectionId:connection.id,connectionRevision:connection.updatedAt.toISOString()};
}
