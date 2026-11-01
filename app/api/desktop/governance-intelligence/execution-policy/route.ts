import type {NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createGovernanceExecutionPolicyHttp} from '@/lib/governance/intelligence/executionPolicyHttp';
import {createGovernanceExecutionPolicyRequestService} from '@/lib/governance/intelligence/executionPolicyRequestService';
export const runtime='nodejs';
const enabled=()=>process.env.AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED==='true';
export async function POST(request:NextRequest){return createGovernanceExecutionPolicyHttp((r,scope)=>createGovernanceExecutionPolicyRequestService(r,prisma as unknown as ReleaseOperationPlanRepo,scope,enabled),enabled)(request)}
