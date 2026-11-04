import "server-only";
import type { PricingPlan } from "./planRegistry";
import { configuredPublicBillingIdentity, publicBillingPolicyEnabled } from "./publicBillingConfig";
import { publicDatabaseNow } from "./publicCreditAuthority";
import type { PublicSql } from "./publicBillingStore";
import type { PublicBillingIdentity } from "./publicCheckoutService";
import type { PublicPlanId } from "./publicPlanCatalog";
import type { BillingStatus, BillingTier } from "./tierCatalog";

export { readPublicEntitlementSnapshot } from "./publicEntitlementSnapshotCore";
import { readPublicEntitlementSnapshot } from "./publicEntitlementSnapshotCore";

/** Raw transactional callers must never map a public projection back to a
 * legacy flat tier. Return undefined only for an actual legacy row. */
export async function publicPricingForStoredRow(tx:PublicSql,org:string,row:{tier:string}|null):Promise<PricingPlan|undefined>{
  if(!row?.tier.startsWith("public_"))return undefined;
  if(!publicBillingPolicyEnabled())throw Error("public_plan_requires_contract");
  const state=await readPublicEntitlementSnapshot(tx,org,configuredPublicBillingIdentity(),await publicDatabaseNow(tx));
  if(!state?.usable)throw Error("billing_entitlement_unavailable");
  return state.pricingPlan;
}
