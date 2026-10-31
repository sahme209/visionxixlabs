import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {identifier} from './contracts';

export interface GovernanceEnrollmentMetadataRepo {
 durableAgentWorkflow?:{findMany(args:unknown):Promise<unknown>};
}
/** Internal metadata only. Callers MUST establish their existing tenant/actor
 * authority separately. This result can refuse an uncovered mutation; it never
 * grants policy, source-read, approval or provider execution authority. */
export async function readGovernanceEnrollmentMetadata(repo:GovernanceEnrollmentMetadataRepo,organizationId:string,parent?:AbortSignal):Promise<boolean>{
 const signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]);
 signal.throwIfAborted();identifier.parse(organizationId);
 if(typeof repo.durableAgentWorkflow?.findMany!=='function')throw Error('governance_enrollment_unavailable');
 const rows=await withGithubAbort(repo.durableAgentWorkflow.findMany({where:{organizationId,OR:[{workflowKind:'governance_baseline_active_v1'},{id:{startsWith:'governance_active_'}}]},orderBy:[{id:'asc'}],take:1}),signal);
 signal.throwIfAborted();
 if(!Array.isArray(rows)||rows.length>1||rows.some(row=>!row||typeof row!=='object'||row.organizationId!==organizationId||typeof row.id!=='string'||row.workflowKind!=='governance_baseline_active_v1'&&!row.id.startsWith('governance_active_')))throw Error('governance_enrollment_unavailable');
 return rows.length===1;
}
export async function assertNoGovernanceEnrollmentForMutation(repo:GovernanceEnrollmentMetadataRepo,organizationId:string,signal?:AbortSignal){
 try{if(await readGovernanceEnrollmentMetadata(repo,organizationId,signal)!==false)throw Error()}
 catch{throw Error('governance_execution_coverage_unavailable')}
}
