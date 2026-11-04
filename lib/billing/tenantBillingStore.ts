import { createBillingPlanReaderCore, isBillingStatus, shapeBillingPlan as shape, type BillingPlanRecord } from "./tenantBillingReadCore";
export type { BillingPlanRecord } from "./tenantBillingReadCore";
import { publicBillingPolicyEnabled, configuredPublicBillingIdentity } from "./publicBillingConfig";
import { planForStripeTier, type PricingPlan } from "./planRegistry";
import type { PublicPlanId } from "./publicPlanCatalog";
/**
 * Tenant billing plan store.
 *
 * Reads + writes the TenantBillingPlan row. A missing or unreadable row
 * resolves to `no_plan`; commercial desktop access therefore fails closed.
 *
 * Hard rules:
 *   - Tier + status validated at the boundary against the closed
 *     unions.
 *   - DB failure on read returns the "no_plan" sentinel so the
 *     dashboard can render an honest "not connected" banner.
 *   - Stripe ids are nullable — the platform works without Stripe.
 */

import "server-only";

import { prisma } from "@/lib/db";
import {
  isBillingTier,
  tierSpec,
  type BillingStatus,
  type BillingTier,
  type TierSpec,
} from "./tierCatalog";

const TRIAL_DAYS = 14;

/** Existing callers retain the historical no-plan fallback on read failure. */
export async function readBillingPlan(organizationId: string): Promise<BillingPlanRecord> {
  return (await readBillingPlanWithAvailability(organizationId)).plan;
}

/** Read-only evidence for surfaces that must distinguish a real missing plan
 * from unavailable storage. No private error details leave this boundary. */
export async function readBillingPlanWithAvailability(organizationId: string, repository: Pick<typeof prisma,"$transaction"|"tenantBillingPlan"> = prisma): Promise<{ plan: BillingPlanRecord; available: boolean }> {
 return createBillingPlanReaderCore(repository, { publicBillingPolicyEnabled, configuredPublicBillingIdentity }).readBillingPlanWithAvailability(organizationId);
}

export function pricingPlanForBillingRecord(record: BillingPlanRecord): PricingPlan {
  if (record.pricingPlanAvailable === false) throw new Error("billing_entitlement_unavailable");
  return record.pricingPlan ?? planForStripeTier(record.tier);
}

/** Idempotently ensure a tenant has a trial row. Called on first sign-in. */
export async function ensureTrialPlan(organizationId: string): Promise<BillingPlanRecord> {
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  try {
    const row = await prisma.tenantBillingPlan.upsert({
      where: { organizationId },
      update: {}, // never overwrite an existing plan from this helper
      create: {
        organizationId,
        tier: "trial",
        status: "trialing",
        trialEndsAt: trialEnds,
      },
    });
    return shape(row.organizationId, {
      tier: isBillingTier(row.tier) ? row.tier : "trial",
      status: isBillingStatus(row.status) ? row.status : "trialing",
      trialEndsAt: row.trialEndsAt,
      currentPeriodEndsAt: row.currentPeriodEndsAt,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    });
  } catch {
    return shape(organizationId, {
      tier: "trial",
      status: "no_plan",
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
    });
  }
}

export interface UpsertBillingPlanInput {
  organizationId: string;
  tier: BillingTier;
  status: BillingStatus;
  trialEndsAt?: Date | null;
  currentPeriodEndsAt?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  lastStripeEventId?: string | null;
  seatQuantity?: number | null;
}

export async function upsertBillingPlan(input: UpsertBillingPlanInput): Promise<BillingPlanRecord> {
  const store = prisma.tenantBillingPlan as unknown as {
    upsert(args: { where: { organizationId: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  const row = await store.upsert({
    where: { organizationId: input.organizationId },
    update: {
      tier: input.tier,
      status: input.status,
      trialEndsAt: input.trialEndsAt ?? null,
      currentPeriodEndsAt: input.currentPeriodEndsAt ?? null,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      lastStripeEventId: input.lastStripeEventId ?? null,
      seatQuantity: input.seatQuantity ?? null,
    },
    create: {
      organizationId: input.organizationId,
      tier: input.tier,
      status: input.status,
      trialEndsAt: input.trialEndsAt ?? null,
      currentPeriodEndsAt: input.currentPeriodEndsAt ?? null,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      lastStripeEventId: input.lastStripeEventId ?? null,
      seatQuantity: input.seatQuantity ?? null,
    },
  });
  return shape(String(row.organizationId), {
    tier: input.tier,
    status: input.status,
    trialEndsAt: row.trialEndsAt instanceof Date ? row.trialEndsAt : null,
    currentPeriodEndsAt: row.currentPeriodEndsAt instanceof Date ? row.currentPeriodEndsAt : null,
    stripeCustomerId: typeof row.stripeCustomerId === "string" ? row.stripeCustomerId : null,
    stripeSubscriptionId: typeof row.stripeSubscriptionId === "string" ? row.stripeSubscriptionId : null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd === true,
    seatQuantity: typeof row.seatQuantity === "number" ? row.seatQuantity : null,
  });
}
