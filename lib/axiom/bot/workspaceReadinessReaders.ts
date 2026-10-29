import 'server-only';
import {prisma} from '@/lib/db';
import {readBillingPlanWithAvailability} from '@/lib/billing/tenantBillingStore';
import {decideDesktopCommercialAccess} from '@/lib/desktop/desktopCommercialAccessPolicy';
import {createRecordedReadinessReaders,type RecordedReadinessRepo} from './recordedReadinessReaders';
/** Real local-storage adapter only. No session bootstrap, credential decryption,
 * live integration check, provider calls or paid-model calls. */
export function workspaceReadinessReaders(){
 return createRecordedReadinessReaders(prisma as unknown as RecordedReadinessRepo,async(organizationId,signal)=>{
  signal.throwIfAborted();
  const result=await readBillingPlanWithAvailability(organizationId);signal.throwIfAborted();
  const access=decideDesktopCommercialAccess(result.plan);
  return {available:result.available,allowed:result.available&&access.allowed,code:access.code};
 });
}
