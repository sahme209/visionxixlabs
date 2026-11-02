import {prisma} from '@/lib/db';
import {createAgentActionExecutionRequestService,type AgentActionExecutionRequestRepo} from '@/lib/desktop/agentActionExecutionRequestService';
import {createAgentActionEligibilityHttp} from '@/lib/desktop/agentActionExecutionHttp';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const GET=createAgentActionEligibilityHttp((request,scope)=>createAgentActionExecutionRequestService(request,prisma as unknown as AgentActionExecutionRequestRepo,scope));
