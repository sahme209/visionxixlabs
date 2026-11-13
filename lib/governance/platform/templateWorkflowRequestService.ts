import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from './sqlRepository';
import {readConfiguredPlatformAdmins} from './currentAuthority';
import {createTemplateWorkflowRequestComposition} from './templateWorkflowRequest';
/** Prepared/unregistered: real native/key/channel resources remain unavailable. */
export function createDefaultTemplateWorkflowRequestService(request:Request){return createTemplateWorkflowRequestComposition(request,{repo:createPlatformSqlRepository(prisma as unknown as PlatformSqlDatabase),verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins})}
