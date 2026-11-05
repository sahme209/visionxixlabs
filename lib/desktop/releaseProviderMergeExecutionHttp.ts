import 'server-only';
import type {NextRequest} from 'next/server';
import {prisma} from '@/lib/db';
import {consumeToken} from '@/lib/api/rateLimiter';
import {resolveRequestDesktopSession} from './resolveRequestDesktopSession';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createReleaseProviderMergeCoordinator,type ProviderMergeCoordinatorPorts} from './releaseProviderMergeCoordinator';
import {createReleaseProviderMergeExecutionHttp} from './releaseProviderMergeExecutionHttpCore';
export async function handleReleaseProviderMergeExecution(request:NextRequest,requestId:string,planId:string,ports:ProviderMergeCoordinatorPorts={}){
 return createReleaseProviderMergeExecutionHttp({repo:prisma as unknown as ReleaseOperationPlanRepo,resolveSession:resolveRequestDesktopSession,consumeToken,createCoordinator:createReleaseProviderMergeCoordinator,ports})(request,requestId,planId);
}
