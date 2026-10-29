import type {NextRequest} from 'next/server';
import {handleReleaseOperationPlanMutation} from '@/lib/desktop/releaseOperationPlanHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
export async function POST(request:NextRequest,context:{params:Promise<{id:string;planId:string}>}){const params=await context.params;return handleReleaseOperationPlanMutation(request,params.id,params.planId,true)}
