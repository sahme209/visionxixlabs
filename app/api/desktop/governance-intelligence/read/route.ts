import type {NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {AwsConnectionReadRepo} from '@/lib/cloud/aws/enrollment/scopedConnection';
import {createGovernanceReadHttp} from '@/lib/governance/intelligence/readHttp';
import {createGovernanceRequestService} from '@/lib/governance/intelligence/requestService';
export const runtime='nodejs';
const enabled=()=>process.env.AXIOM_GOVERNANCE_INTELLIGENCE_ENABLED==='true';
export async function POST(request:NextRequest){return createGovernanceReadHttp((r,scope)=>createGovernanceRequestService(r,prisma as unknown as ReleaseOperationPlanRepo&AwsConnectionReadRepo,scope,enabled),enabled)(request)}
