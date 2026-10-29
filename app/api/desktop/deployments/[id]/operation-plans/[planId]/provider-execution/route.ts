import type {NextRequest} from 'next/server';
import {handleReleaseProviderMergeExecution} from '@/lib/desktop/releaseProviderMergeExecutionHttp';
import {releaseAcceptanceEnabled,releaseAcceptancePlanAllowed} from '@/lib/desktop/releaseAcceptanceScope';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
// Trusted adapters are composed locally; production execution remains unactivated.
async function handle(request:NextRequest,context:{params:Promise<{id:string;planId:string}>}){const p=await context.params;return handleReleaseProviderMergeExecution(request,p.id,p.planId,{enabled:()=>releaseAcceptanceEnabled(),isPlanAllowed:p=>releaseAcceptancePlanAllowed({organizationId:p.organizationId,repositoryFullName:p.pullRequest.repositoryFullName}),useScopedInstallationTokens:true,useVerifiedLinearTopology:true,mergeTopologyPolicy:'empty_effective_target'})}
export {handle as GET,handle as POST};
