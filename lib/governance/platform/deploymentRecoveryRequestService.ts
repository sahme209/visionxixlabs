import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from './sqlRepository';
import {readConfiguredPlatformAdmins} from './currentAuthority';
import {createDeploymentRecoveryRequestComposition} from './deploymentRecoveryRequest';
const unavailable=async():Promise<never>=>{throw Error('platform_deployment_native_qualification_unavailable')};
/** Unregistered. Existing-schema historical reads only; no invented real native
 * terminal profile, issuer qualification, deployment or production capability. */
export function createDefaultDeploymentRecoveryRequestService(request:Request){return createDeploymentRecoveryRequestComposition(request,{clock:async()=>{throw Error('platform_native_time_unqualified')},repo:createPlatformSqlRepository(prisma as unknown as PlatformSqlDatabase),verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins,source:{assertCurrent:unavailable,assertEvidenceCurrent:unavailable,readTerminal:unavailable}})}
