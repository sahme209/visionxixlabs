import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from '../sqlRepository';
import {readConfiguredPlatformAdmins} from '../currentAuthority';
import {createOperationalWorkloadIdentity} from './workloadIdentity';
import {createOperationalDelegationRequestComposition} from './operationalRequest';
const unavailable=async():Promise<never>=>{throw Error('operational_source_qualification_unavailable')};
/** Prepared current-user default, unregistered. Actual SQL history is available
 * to current authenticated readers; new delegation/observation stays unavailable
 * without qualified original source/target suppliers. No issuer/send capability. */
export function createDefaultOperationalRequestService(request:Request){return createOperationalDelegationRequestComposition(request,{
 repo:createPlatformSqlRepository(prisma as unknown as PlatformSqlDatabase),verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins,
 source:{readManifest:unavailable,assertCurrent:unavailable},
 identity:createOperationalWorkloadIdentity({readProfile:unavailable,assertProfileCurrent:unavailable},unavailable,request.signal),
})}
