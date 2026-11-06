import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {RevisionScope} from './revisionStore';
import {createPrivateGovernanceRequestAuthority,type CapturedSessionResolver} from './requestAuthorityCore';
import {createGovernanceExecutionPolicyRequestServiceCore} from './executionPolicyRequestServiceCore';
import {createGithubGovernanceCollectionRequestServiceCore} from './githubCollectionRequestServiceCore';
import {createGovernanceRequestServiceCore} from './requestServiceCore';
import type {createGithubGovernanceDiscoveryCore} from './githubDiscoveryCore';
import {assertPrivateMergeExecutionComposition,type PrivateMergeExecutionCoverage} from './privateMergeExecutionCoverage';
export interface PrivateGovernanceMergeDependencies {
 resolveSession:CapturedSessionResolver;
 githubAuth:{resolveReleaseInstallationToken:Parameters<typeof createGithubGovernanceDiscoveryCore>[0]['resolveToken']};
 fetch:typeof fetch;
 now:()=>number;
 executionCoverage?:PrivateMergeExecutionCoverage;
}
/** Direct GitHub merge composition only. AWS evidence is explicitly unsupported;
 * actual AWS adapters and full source coverage remain a separate open gate. */
export function createPrivateGovernanceMergeRequestService(request:NextRequest,repo:ReleaseOperationPlanRepo,scope:RevisionScope,isEnabled:()=>boolean,dependencies:PrivateGovernanceMergeDependencies){
 const authority=createPrivateGovernanceRequestAuthority(request,dependencies.resolveSession);
 const registration=dependencies.executionCoverage;
 if(registration)assertPrivateMergeExecutionComposition(registration,repo,dependencies.resolveSession,dependencies.githubAuth,dependencies.fetch);
 const refuseAws=():never=>{throw Error('governance_private_merge_aws_evidence_unsupported')};
 const service=createGovernanceRequestServiceCore(request,repo,scope,isEnabled,{
  authority,executionPolicies:createGovernanceExecutionPolicyRequestServiceCore(request,repo,scope,isEnabled,authority,dependencies.now),
  github:revalidationOnly=>createGithubGovernanceCollectionRequestServiceCore(request,repo,scope,isEnabled,{revalidationOnly},{authority,resolveToken:dependencies.githubAuth.resolveReleaseInstallationToken,fetch:dependencies.fetch,now:dependencies.now}),
  aws:()=>({observe:async()=>refuseAws(),collect:async()=>refuseAws()}),
  assertSource:e=>{if(e.source==='aws')refuseAws()},now:dependencies.now,deployment:()=>({}),
  ...(registration?{coverage:registration.forRequest(request,scope)}:{}),
 });
 return {...service,async readDrift(id:string){
  // Drift normally reports unavailable observations as unknown. Unsupported AWS
  // evidence must refuse explicitly before that recoverable-source boundary.
  const revision=await service.readRevision(id);
  for(const digest of revision.baseline.evidenceDigests)await service.readEvidence(digest);
  return service.readDrift(id);
 }};
}
