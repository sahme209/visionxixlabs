import {prisma} from '@/lib/db';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createAgentActionExecutionRequestService} from '@/lib/desktop/agentActionExecutionRequestService';
import {createAgentActionExecutionHttp} from '@/lib/desktop/agentActionExecutionHttp';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const handle=createAgentActionExecutionHttp((request,scope)=>createAgentActionExecutionRequestService(request,prisma as unknown as ReleaseOperationPlanRepo,scope));
export const GET=handle;
export const POST=handle;
