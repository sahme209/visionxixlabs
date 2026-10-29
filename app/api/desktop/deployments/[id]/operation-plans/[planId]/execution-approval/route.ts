import type {NextRequest} from 'next/server';
import {handleReleaseExecutionApproval} from '@/lib/desktop/releaseExecutionApprovalHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
async function handle(request:NextRequest,context:{params:Promise<{id:string;planId:string}>}){const p=await context.params;return handleReleaseExecutionApproval(request,p.id,p.planId)}
export {handle as GET,handle as POST,handle as DELETE};
