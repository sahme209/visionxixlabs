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

const STATUS_LITERALS: BillingStatus[] = [
  "trialing", "active", "past_due", "canceled", "no_plan",
];
function isBillingStatus(v: string): v is BillingStatus {
  return (STATUS_LITERALS as string[]).includes(v);
}

export interface BillingPlanRecord {
  organizationId: string;
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

/** Existing callers retain the historical no-plan fallback on read failure. */
export async function readBillingPlan(organizationId: string): Promise<BillingPlanRecord> {
  return (await readBillingPlanWithAvailability(organizationId)).plan;
}

/** Read-only evidence for surfaces that must distinguish a real missing plan
 * from unavailable storage. No private error details leave this boundary. */
export async function readBillingPlanWithAvailability(organizationId: string): Promise<{ plan: BillingPlanRecord; available: boolean }> {
  let available = true;
  try {
    const row = await prisma.tenantBillingPlan.findUnique({
      where: { organizationId },
    });
    if (row && isBillingTier(row.tier) && isBillingStatus(row.status)) {
      // Trial product retired: coerce any legacy 'trial' tier or 'trialing'
      // status row to no_plan on read. We don't write the DB here — old rows
      // remain as historical artefacts but never surface as an active trial.
      const isLegacyTrial = row.tier === "trial" || row.status === "trialing";
      if (isLegacyTrial) {
        return { available, plan: shape(row.organizationId, {
          tier: "trial",
          status: "no_plan",
          trialEndsAt: null,
          currentPeriodEndsAt: null,
          stripeCustomerId: row.stripeCustomerId,
          stripeSubscriptionId: row.stripeSubscriptionId,
          cancelAtPeriodEnd: false,
        }) };
      }
      return { available, plan: shape(row.organizationId, {
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
  return { available, plan: shape(organizationId, {
    tier: "trial",
    status: "no_plan",
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    cancelAtPeriodEnd: false,
  }) };
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

function shape(organizationId: string, p: {
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
