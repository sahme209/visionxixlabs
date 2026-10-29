import type {NextRequest} from 'next/server';
import {createReleaseWorkflowEvidenceHttp} from '@/lib/desktop/releaseWorkflowEvidenceHttp';
import {createReleaseWorkflowEvidenceServices} from '@/lib/desktop/releaseWorkflowEvidenceServices';
import {releaseAcceptanceEnabled,releaseAcceptancePlanAllowed} from '@/lib/desktop/releaseAcceptanceScope';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
const handler=createReleaseWorkflowEvidenceHttp((request,repo,scope,plan,requesterUserId)=>createReleaseWorkflowEvidenceServices(request,repo,scope,plan,{requesterUserId,isEnabled:()=>releaseAcceptanceEnabled(scope.organizationId),isPlanAllowed:releaseAcceptancePlanAllowed}));
async function handle(request:NextRequest,context:{params:Promise<{id:string;planId:string}>}){const p=await context.params;return handler(request,p.id,p.planId)}
export {handle as GET,handle as POST};
