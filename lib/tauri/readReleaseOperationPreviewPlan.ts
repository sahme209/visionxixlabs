import 'server-only';
import {prisma} from '@/lib/db';
import {readReleasePullRequest} from '@/lib/connectors/github/readReleasePullRequest';
import {parseGithubRepositoryUrl} from '@/lib/connectors/github/releaseEvidence';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parseDeploymentIntake} from './deploymentIntakeSchema';
import {validateIntake} from './deploymentOperations';
import {sha256ContentHash} from './contentHash';
import {buildReleaseMergePlan} from './releaseMergePlan';
export async function readReleaseOperationPreviewPlan(input:{organizationId:string;requestId:string;expectedVersion:number;pullRequestNumber:number;method:'merge'|'squash'|'rebase';signal:AbortSignal}){
 const {organizationId,requestId,expectedVersion,pullRequestNumber,method,signal}=input;
 const lookup=()=>prisma.tauriDeploymentRequest.findFirst({where:{organizationId,id:requestId}});
 const row=await withGithubAbort(lookup(),signal);
 if(!row||row.id!==requestId||row.organizationId!==organizationId||row.version!==expectedVersion||row.status!=='submitted')throw Error('release_plan_changed');
 const parsed=parseDeploymentIntake(row.intakeJson);if(!parsed.ok||parsed.intake.id!==requestId||parsed.intake.tenantId!==organizationId||validateIntake(parsed.intake).length||parsed.intake.noPrRequired||parsed.intake.repositoryUrls.length!==1)throw Error('release_plan_changed');
 if(Date.parse(parsed.intake.windowEndUtc)<=Date.now())throw Error('release_plan_window_expired');
 const repository=parseGithubRepositoryUrl(parsed.intake.repositoryUrls[0]);if(!repository)throw Error('release_plan_changed');
 const repositoryFullName=`${repository.owner}/${repository.repository}`;
 if(!parsed.intake.productionPrUrls.includes(`https://github.com/${repositoryFullName}/pull/${pullRequestNumber}`))throw Error('release_plan_changed');
 const digest=sha256ContentHash({requestVersion:row.version,intake:row.intakeJson});
 const evidence=await readReleasePullRequest({organizationId,repositoryFullName,pullRequestNumber,signal});
 if(!evidence.ok)throw Error('release_plan_source_unavailable');
 const built=buildReleaseMergePlan(row,{organizationId,requestId,expectedVersion,expectedDigest:digest,method,observation:evidence.observation});if(!built.ok)throw Error('release_plan_source_unavailable');
 const current=await withGithubAbort(lookup(),signal);signal.throwIfAborted();
 if(!current||current.id!==requestId||current.organizationId!==organizationId||current.status!=='submitted'||current.version!==row.version||sha256ContentHash({requestVersion:current.version,intake:current.intakeJson})!==digest)throw Error('release_plan_changed');
 return built.plan;
}
