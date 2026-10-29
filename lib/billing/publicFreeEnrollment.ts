import "server-only";
import { publicEnrollmentId, type PublicBillingIdentity } from "./publicCheckoutService";
import { ensurePublicEnrollment, lockPublicOrganization, readPublicEnrollment, type PublicSql } from "./publicBillingStore";
/** Called by the trusted sign-in bootstrap only for newly created personal
 * membership. Existing workspace billing is never rewritten as Free. */
export async function enrollNewPublicWorkspace(tx:PublicSql,organizationId:string,identity:PublicBillingIdentity):Promise<boolean>{
  await lockPublicOrganization(tx,organizationId);
  if(await readPublicEnrollment(tx,organizationId))return false;
  const old=await tx.$queryRawUnsafe<unknown[]>('SELECT "organizationId" FROM "TenantBillingPlan" WHERE "organizationId"=$1',organizationId);
  if(old.length)return false;
  const members=await tx.$queryRawUnsafe<Array<{role:string}>>('SELECT role FROM "OrgMembership" WHERE "organizationId"=$1 AND "acceptedAt" IS NOT NULL',organizationId);
  if(!members.length||!members.some(m=>m.role==='owner'))throw Error('public_enrollment_owner_required');
  await ensurePublicEnrollment(tx,{organizationId,enrollmentId:publicEnrollmentId(identity,organizationId),...identity});
  return true;
}
