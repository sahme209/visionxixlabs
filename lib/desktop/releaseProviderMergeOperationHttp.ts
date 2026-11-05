import 'server-only';
import type {NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import {consumeToken} from '@/lib/api/rateLimiter';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createReleaseProviderMergeOperationHttp} from './releaseProviderMergeOperationHttpCore';
export async function handleReleaseProviderMergeOperation(request:NextRequest,requestId:string,planId:string){
 return createReleaseProviderMergeOperationHttp({repo:prisma as unknown as ReleaseOperationPlanRepo,resolveSession:resolveRequestDesktopSession,consumeToken})(request,requestId,planId);
}
