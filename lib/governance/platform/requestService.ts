import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {readConfiguredPlatformAdmins} from './currentAuthority';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from './sqlRepository';
import {createPlatformRequestComposition} from './requestComposition';
/** Actual default server composition. No test/customer-supplied ports. This is
 * not yet registered as an HTTP route or a provider execution permission. */
export function createDefaultPlatformRequestService(request:{headers:Headers;signal?:AbortSignal}){
 return createPlatformRequestComposition(request,{
  repo:createPlatformSqlRepository(prisma as unknown as PlatformSqlDatabase),
  verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins,
  clock:async()=>{throw Error('platform_native_time_unqualified')},
 });
}
