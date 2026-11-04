import 'server-only';
import {assertNoUncoveredGovernanceExecution} from '@/lib/governance/intelligence/uncoveredExecution';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {createGovernanceRequestService} from '@/lib/governance/intelligence/requestService';
import {createEnrollmentDrainAuthority} from '@/lib/governance/intelligence/enrollmentDrainAuthority';
import {resolveReleaseInstallationToken,readReleaseInstallationEligibility,consumeReleaseInstallationEligibility} from '@/lib/connectors/github/githubAppAuth';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import {createReleaseProviderMergeCoordinatorCore,type ProviderMergeCoordinatorPorts} from './releaseProviderMergeCoordinatorCore';
export type {ProviderMergeCoordinatorPorts} from './releaseProviderMergeCoordinatorCore';
export function createReleaseProviderMergeCoordinator(repo:ReleaseOperationPlanRepo,request:NextRequest,ports:ProviderMergeCoordinatorPorts={},expectedIdentity?:{id:string;userId:string;organizationId:string}){
 return createReleaseProviderMergeCoordinatorCore(repo,request,ports,{resolveSession:resolveRequestDesktopSession,createGovernanceService:(request,repo,scope,enabled)=>createGovernanceRequestService(request,repo as ReleaseOperationPlanRepo&AwsConnectionReadRepo,scope,enabled),governanceEnabled:()=>process.env.AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED==='true',enabled:()=>process.env.AXIOM_RELEASE_PROVIDER_MERGE_ENABLED==='true',releaseAuth:{resolveReleaseInstallationToken,readReleaseInstallationEligibility,consumeReleaseInstallationEligibility},createDrainAuthority:createEnrollmentDrainAuthority,fetch,now:()=>Date.now(),assertUncovered:assertNoUncoveredGovernanceExecution},expectedIdentity);
}
