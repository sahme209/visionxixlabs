import type {NextRequest} from 'next/server';
import {handleReleaseOperationPlans} from '@/lib/desktop/releaseOperationPlanHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){const params=await context.params;return handleReleaseOperationPlans(request,params.id)}
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}){const params=await context.params;return handleReleaseOperationPlans(request,params.id)}
