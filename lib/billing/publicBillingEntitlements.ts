import "server-only";
import { publicBillingWindow } from "./publicCreditAuthority";
import { planForStripeTier, type PricingPlan } from "./planRegistry";
import { configuredPublicBillingIdentity, publicBillingPolicyEnabled } from "./publicBillingConfig";
import { publicDatabaseNow } from "./publicCreditAuthority";
import type { PublicSql } from "./publicBillingStore";
import type { PublicBillingIdentity } from "./publicCheckoutService";
import type { PublicPlanId } from "./publicPlanCatalog";
import type { BillingStatus, BillingTier } from "./tierCatalog";

export async function readPublicEntitlementSnapshot(tx:PublicSql,organizationId:string,identity:PublicBillingIdentity,now:Date){
  const state=await publicBillingWindow(tx,organizationId,identity,now);if(!state)return null;
  const paid=state.contract?.binding,planId:PublicPlanId=paid?.planId??'free';
  const tier:BillingTier=planId==='pro'?'growth':planId==='enterprise'?'enterprise':'trial';
  const base=planForStripeTier(tier),usable=state.available;
  const seats=usable?state.window.seats:0,ai=usable?state.window.includedCents:0;
  const monthlyPrice=planId==='free'?0:planId==='pro'?2900:7900;
  const annualPrice=planId==='free'?0:planId==='pro'?27840:75840;
  const pricingPlan:PricingPlan={...base,displayName:planId==='free'?'Free':planId==='pro'?'Pro':'Enterprise',monthlyPriceCents:monthlyPrice,annualPriceCents:annualPrice,
    entitlements:{...base.entitlements,maxUsers:seats,includedAICreditsCents:ai,overagePolicy:'hard_stop',overageInputCentsPerMillion:null,overageOutputCentsPerMillion:null}};
  const status:BillingStatus=usable?'active':state.contract?.status==='canceled'?'canceled':state.contract?.status==='past_due'?'past_due':'no_plan';
  return {publicPolicy:identity,planId,tier,status,usable,pricingPlan,seatQuantity:seats,monthlyDeployments:usable?state.window.monthlyDeployments:0,
    currentPeriodEndsAt:state.contract?.coverage?.serviceEnd,creditPeriodStart:usable?state.window.start:undefined,creditPeriodEnd:usable?state.window.end:undefined,
    stripeCustomerId:paid?.customerId,stripeSubscriptionId:paid?.subscriptionId,cancelAtPeriodEnd:state.contract?.cancelAtPeriodEnd??false};
}

/** Raw transactional callers must never map a public projection back to a
 * legacy flat tier. Return undefined only for an actual legacy row. */
export async function publicPricingForStoredRow(tx:PublicSql,org:string,row:{tier:string}|null):Promise<PricingPlan|undefined>{
  if(!row?.tier.startsWith("public_"))return undefined;
  if(!publicBillingPolicyEnabled())throw Error("public_plan_requires_contract");
  const state=await readPublicEntitlementSnapshot(tx,org,configuredPublicBillingIdentity(),await publicDatabaseNow(tx));
  if(!state?.usable)throw Error("billing_entitlement_unavailable");
  return state.pricingPlan;
}
