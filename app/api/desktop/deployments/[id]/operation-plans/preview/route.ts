import type {NextRequest} from 'next/server';
import {handleReleaseOperationPlanPreview} from '@/lib/desktop/releaseOperationPlanHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){const params=await context.params;return handleReleaseOperationPlanPreview(request,params.id)}
