import type {NextRequest} from 'next/server';
import {handleReleaseDeploymentExecution} from '@/lib/desktop/releaseDeploymentExecutionHttp';
import {createReleaseDeploymentServices} from '@/lib/desktop/releaseDeploymentServices';
import {releaseAcceptanceEnabled,releaseAcceptancePlanAllowed} from '@/lib/desktop/releaseAcceptanceScope';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
async function handle(request:NextRequest,context:{params:Promise<{id:string;planId:string}>}){const p=await context.params;return handleReleaseDeploymentExecution(request,p.id,p.planId,(r,repo,scope)=>createReleaseDeploymentServices(r,repo,scope,{sourcePolicy:'github_immutable_release_v1',allowImmutableTagDispatch:()=>process.env.AXIOM_RELEASE_IMMUTABLE_ACCEPTANCE_ENABLED==='true'&&releaseAcceptanceEnabled(scope.organizationId),isEnabled:()=>releaseAcceptanceEnabled(scope.organizationId),isPlanAllowed:p=>releaseAcceptancePlanAllowed({organizationId:p.organizationId,repositoryFullName:p.repositoryFullName})}).ports)}
export {handle as GET,handle as POST};
