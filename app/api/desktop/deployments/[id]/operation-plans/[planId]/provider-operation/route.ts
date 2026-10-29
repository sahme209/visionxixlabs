import type {NextRequest} from 'next/server';
import {handleReleaseProviderMergeOperation} from '@/lib/desktop/releaseProviderMergeOperationHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=15;
async function handle(request:NextRequest,context:{params:Promise<{id:string;planId:string}>}){const p=await context.params;return handleReleaseProviderMergeOperation(request,p.id,p.planId)}
export {handle as GET,handle as POST};
