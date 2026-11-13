import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from '../sqlRepository';
import {readConfiguredPlatformAdmins} from '../currentAuthority';
import {createCustodianRequestComposition} from './custodianRequest';
const unavailable=async():Promise<never>=>{throw Error('custodian_native_source_qualification_unavailable')};
/** Unregistered. Paired current-authority history only works with existing
 * schema; every new control/review/observation refuses unqualified real sources. */
export function createDefaultCustodianRequestService(request:Request){return createCustodianRequestComposition(request,{repo:createPlatformSqlRepository(prisma as unknown as PlatformSqlDatabase),verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins,drainSource:{assertCurrent:unavailable,assertAbortSafe:unavailable},closureSource:{readEvidence:unavailable,assertCurrent:unavailable}})}
