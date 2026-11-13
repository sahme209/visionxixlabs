import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from './sqlRepository';
import {readConfiguredPlatformAdmins} from './currentAuthority';
import {createImageWorkflowRequestComposition} from './imageWorkflowRequest';
/** Prepared only; no route or real decoder/key/upload supplier is registered. */
export function createDefaultImageWorkflowRequestService(request:Request){return createImageWorkflowRequestComposition(request,{repo:createPlatformSqlRepository(prisma as unknown as PlatformSqlDatabase),verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins})}
