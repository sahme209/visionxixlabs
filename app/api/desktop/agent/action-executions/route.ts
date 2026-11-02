import {prisma} from '@/lib/db';
import type {AgentActionExecutionRequestRepo} from '@/lib/desktop/agentActionExecutionRequestService';
import {createAgentActionExecutionRequestService} from '@/lib/desktop/agentActionExecutionRequestService';
import {createAgentActionExecutionHttp} from '@/lib/desktop/agentActionExecutionHttp';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const handle=createAgentActionExecutionHttp((request,scope)=>createAgentActionExecutionRequestService(request,prisma as unknown as AgentActionExecutionRequestRepo,scope));
export const GET=handle;
export const POST=handle;
