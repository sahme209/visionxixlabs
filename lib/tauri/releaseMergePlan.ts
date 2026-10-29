import {z} from 'zod';
import {sha256ContentHash} from './contentHash';
import {parseDeploymentIntake} from './deploymentIntakeSchema';
import {validateIntake} from './deploymentOperations';

const identifier=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\0\r\n]/.test(v));
const repository=z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
const sha=z.string().regex(/^[a-f0-9]{40}$/);
const instant=z.string().max(50).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/).refine(v=>Number.isFinite(Date.parse(v)));
export const releaseMergeObservationSchema=z.object({
 connectionId:identifier,connectionRevision:instant,repositoryFullName:repository,
 number:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),headRepositoryFullName:repository,
 headRef:identifier,headSha:sha,baseRef:identifier,baseSha:sha,
 state:z.literal('open'),draft:z.literal(false),merged:z.literal(false),
}).strict();
const inputSchema=z.object({organizationId:identifier,requestId:identifier,expectedVersion:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),expectedDigest:z.string().regex(/^[a-f0-9]{64}$/),method:z.enum(['merge','squash','rebase']),observation:releaseMergeObservationSchema}).strict();
interface StoredRelease {id:string;organizationId:string;version:number;status:string;intakeJson:unknown}
function githubRepository(value:string):string|null {
 try {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash)return null;
  const name=url.pathname.replace(/^\//,'').replace(/\/$/,'').replace(/\.git$/,'');
  return repository.safeParse(name).success?name:null;
 }catch{return null}
}
/** Internal data contract built from a stored release and a tenant-authorized provider read.
 * A plan/digest is NOT permission or approval. No HTTP caller or provider write is enabled.
 * Execution must independently recheck actor, reviewer, window, connection and exact PR head,
 * provider protections/checks and outcome ledger. Base SHA is evidence, not an atomic GitHub guard.
 */
export function buildReleaseMergePlan(row:StoredRelease,input:unknown){
 const refuse=()=>({ok:false as const,reason:'release_merge_plan_unavailable' as const});
 try{
  const parsed=inputSchema.safeParse(input);if(!parsed.success)return refuse();
  const value=parsed.data;
  if(row.organizationId!==value.organizationId||row.id!==value.requestId||row.version!==value.expectedVersion||row.status!=='submitted')return refuse();
  if(sha256ContentHash({requestVersion:row.version,intake:row.intakeJson})!==value.expectedDigest)return refuse();
  const stored=parseDeploymentIntake(row.intakeJson);if(!stored.ok)return refuse();
  const intake=stored.intake,pr=value.observation;
  if(intake.tenantId!==value.organizationId||intake.id!==value.requestId||validateIntake(intake).length||intake.noPrRequired
    ||intake.repositoryUrls.length!==1||githubRepository(intake.repositoryUrls[0])!==pr.repositoryFullName
    ||pr.headRepositoryFullName!==pr.repositoryFullName||intake.sourceBranch!==pr.headRef||intake.targetBranch!==pr.baseRef)return refuse();
  const expectedUrl=`https://github.com/${pr.repositoryFullName}/pull/${pr.number}`;
  if(!intake.productionPrUrls.includes(expectedUrl))return refuse();
  const plan=Object.freeze({
   kind:'merge_pull_request' as const,organizationId:value.organizationId,requestId:value.requestId,
   requestVersion:value.expectedVersion,intakeDigest:value.expectedDigest,
   connectionId:pr.connectionId,connectionRevision:pr.connectionRevision,
   window:Object.freeze({startUtc:intake.windowStartUtc,endUtc:intake.windowEndUtc}),
   method:value.method,
   pullRequest:Object.freeze({repositoryFullName:pr.repositoryFullName,number:pr.number,url:expectedUrl,headRef:pr.headRef,headSha:pr.headSha,baseRef:pr.baseRef,baseSha:pr.baseSha}),
  });
  return {ok:true as const,plan,digest:sha256ContentHash(plan)};
 }catch{return refuse()}
}
