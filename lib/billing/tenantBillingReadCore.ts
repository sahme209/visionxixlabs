import "server-only";
import type { PrismaClient } from "@/lib/prismaClient";
import { publicDatabaseNow } from "./publicCreditAuthority";
import { readPublicEntitlementSnapshot } from "./publicEntitlementSnapshotCore";
import { isBillingTier, tierSpec, type BillingStatus, type BillingTier, type TierSpec } from "./tierCatalog";
import type { PricingPlan } from "./planRegistry";
import type { PublicPlanId } from "./publicPlanCatalog";
import type { PublicBillingIdentity } from "./publicCheckoutService";

export type BillingPlanReadRepository = Pick<PrismaClient, "$transaction" | "tenantBillingPlan">;
const STATUS_LITERALS: BillingStatus[] = [
  "trialing", "active", "past_due", "canceled", "no_plan",
];
export function isBillingStatus(v: string): v is BillingStatus {
  return (STATUS_LITERALS as string[]).includes(v);
}

export interface BillingPlanRecord {
  organizationId: string;
  publicPlanId?: PublicPlanId;
  pricingPlan?: PricingPlan;
  pricingPlanAvailable?: boolean;
  creditPeriodStart?: string;
  creditPeriodEnd?: string;
  tier: BillingTier;
  status: BillingStatus;
  trialEndsAt?: string;
  currentPeriodEndsAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  seatQuantity?: number;
  cancelAtPeriodEnd: boolean;
  /** Days remaining in trial (when status === 'trialing'), else 0. */
  trialDaysRemaining: number;
  /** Resolved tier spec (caps + label). */
  spec: TierSpec;
}

export function createBillingPlanReaderCore(repository: BillingPlanReadRepository, configuration: {
 publicBillingPolicyEnabled: () => boolean;
 configuredPublicBillingIdentity: () => PublicBillingIdentity;
 strictCurrentRecords?: boolean;
}) {
 const { publicBillingPolicyEnabled, configuredPublicBillingIdentity } = configuration;
 const strictCurrentRecords = configuration.strictCurrentRecords === true;
async function readBillingPlanWithAvailability(organizationId: string): Promise<{ plan: BillingPlanRecord; available: boolean }> {
  let available = true;
  let unresolvedPublicPlan: PublicPlanId | undefined;
  try {
    if (publicBillingPolicyEnabled()) {
      const publicPlan = await repository.$transaction(async tx => readPublicEntitlementSnapshot(tx,organizationId,configuredPublicBillingIdentity(),await publicDatabaseNow(tx)),{isolationLevel:"RepeatableRead"});
      if (publicPlan) {
        const plan=shapeBillingPlan(organizationId,{tier:publicPlan.tier,status:publicPlan.status,trialEndsAt:null,currentPeriodEndsAt:publicPlan.currentPeriodEndsAt?new Date(publicPlan.currentPeriodEndsAt):null,stripeCustomerId:publicPlan.stripeCustomerId??null,stripeSubscriptionId:publicPlan.stripeSubscriptionId??null,seatQuantity:publicPlan.seatQuantity,cancelAtPeriodEnd:publicPlan.cancelAtPeriodEnd});
        return {available:true,plan:{...plan,publicPlanId:publicPlan.planId,pricingPlan:publicPlan.pricingPlan,pricingPlanAvailable:publicPlan.usable,creditPeriodStart:publicPlan.creditPeriodStart,creditPeriodEnd:publicPlan.creditPeriodEnd,spec:{...plan.spec,label:publicPlan.pricingPlan.displayName,requiresStripe:publicPlan.planId!=="free"}}};
      }
    }
    const row = await repository.tenantBillingPlan.findUnique({
      where: { organizationId },
    });
    if (row?.tier.startsWith("public_")) {
      unresolvedPublicPlan=row.tier==="public_pro_v1"?"pro":row.tier==="public_enterprise_v1"?"enterprise":"free";
      throw new Error("public_plan_requires_contract");
    }
    if (strictCurrentRecords && row && (!isBillingTier(row.tier) || !isBillingStatus(row.status))) {
      throw new Error("billing_current_record_unavailable");
    }
    if (row && isBillingTier(row.tier) && isBillingStatus(row.status)) {
      // Trial product retired: coerce any legacy 'trial' tier or 'trialing'
      // status row to no_plan on read. We don't write the DB here — old rows
      // remain as historical artefacts but never surface as an active trial.
      const isLegacyTrial = row.tier === "trial" || row.status === "trialing";
      if (isLegacyTrial) {
        return { available, plan: shapeBillingPlan(row.organizationId, {
          tier: "trial",
          status: "no_plan",
          trialEndsAt: null,
          currentPeriodEndsAt: null,
          stripeCustomerId: row.stripeCustomerId,
          stripeSubscriptionId: row.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        }) };
      }
      return { available, plan: shapeBillingPlan(row.organizationId, {
        tier: row.tier,
        status: row.status,
        trialEndsAt: row.trialEndsAt,
        currentPeriodEndsAt: row.currentPeriodEndsAt,
        stripeCustomerId: row.stripeCustomerId,
        stripeSubscriptionId: row.stripeSubscriptionId,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        seatQuantity: typeof (row as unknown as { seatQuantity?: unknown }).seatQuantity === "number"
          ? (row as unknown as { seatQuantity: number }).seatQuantity
          : null,
      }) };
    }
  } catch {
    available = false;
    // Keep the legacy fallback while exposing that its evidence was unavailable.
  }
  const unavailablePlan = shapeBillingPlan(organizationId, {
    tier: "trial",
    status: "no_plan",
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
  });
  return {available,plan:{...unavailablePlan,...(!available&&(publicBillingPolicyEnabled()||unresolvedPublicPlan)?{pricingPlanAvailable:false,publicPlanId:unresolvedPublicPlan}: {})}};
}

return Object.freeze({ readBillingPlanWithAvailability });
}

export function shapeBillingPlan(organizationId: string, p: {
  tier: BillingTier;
  status: BillingStatus;
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  seatQuantity?: number | null;
}): BillingPlanRecord {
  const trialDaysRemaining = computeTrialDaysRemaining(p.status, p.trialEndsAt);
  return {
    organizationId,
    tier: p.tier,
    status: p.status,
    trialEndsAt: p.trialEndsAt?.toISOString(),
    currentPeriodEndsAt: p.currentPeriodEndsAt?.toISOString(),
    stripeCustomerId: p.stripeCustomerId ?? undefined,
    stripeSubscriptionId: p.stripeSubscriptionId ?? undefined,
    cancelAtPeriodEnd: p.cancelAtPeriodEnd,
    seatQuantity: p.seatQuantity ?? undefined,
    trialDaysRemaining,
    spec: tierSpec(p.tier),
  };
}

function computeTrialDaysRemaining(status: BillingStatus, trialEndsAt: Date | null): number {
  if (status !== "trialing" || !trialEndsAt) return 0;
  const ms = trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
