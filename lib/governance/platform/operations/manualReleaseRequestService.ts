import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {readConfiguredPlatformAdmins} from '../currentAuthority';
import type {PlatformSqlDatabase} from '../sqlRepository';
import {createManualReleaseSqlRepository} from './manualReleaseSqlRepository';
import {createManualReleaseSource} from './releasePreparation';
import {createManualReleaseRequestComposition} from './manualReleaseRequest';
const unavailable=async():Promise<never>=>{throw Error('manual_release_source_qualification_unavailable')};
/** Not route-registered. Real paired possession/current SQL history works;
 * new preparation/review/notice stays refused until CI/artifact/schema/recovery
 * evidence has a qualified private source. Owner production click is external. */
export function createDefaultManualReleaseRequestService(request:{headers:Headers;signal?:AbortSignal}){
 return createManualReleaseRequestComposition(request,{
  clock:unavailable,repo:createManualReleaseSqlRepository(prisma as unknown as PlatformSqlDatabase),verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins,
  source:createManualReleaseSource({readBundle:unavailable,assertQualified:unavailable}),
 });
}
