import "server-only";

import type { UpsertBillingPlanInput } from "./tenantBillingStore";

type PlanWrite = UpsertBillingPlanInput & {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  lastStripeEventId: string;
};
export interface SubscriptionBinding {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  lastStripeEventId: string | null;
}
interface SubscriptionTransaction {
  stripeBillingEvent: { create(args: { data: { id: string; type: string } }): Promise<unknown> };
  tenantBillingPlan: {
    findUnique(args: unknown): Promise<SubscriptionBinding | null>;
    findFirst(args: unknown): Promise<{ organizationId: string } | null>;
    upsert(args: unknown): Promise<unknown>;
  };
}
export interface SubscriptionEventRepository {
  $transaction<T>(operation: (transaction: SubscriptionTransaction) => Promise<T>, options: { isolationLevel: "Serializable" }): Promise<T>;
}

const replay = new Error("subscription_event_replay");
const ownershipConflict = new Error("subscription_event_ownership_conflict");

/** Atomic durable consumption for a previously observed binding and provider snapshot. */
export async function consumeSubscriptionEvent(
  eventType: string,
  input: PlanWrite,
  repository: SubscriptionEventRepository,
  expectedBinding: SubscriptionBinding | null,
): Promise<"applied" | "replay" | "ownership_conflict"> {
  try {
    return await repository.$transaction(async (tx) => {
      try {
        await tx.stripeBillingEvent.create({ data: { id: input.lastStripeEventId, type: eventType } });
      } catch (error) {
        // Only a unique violation at the event-ledger insert is a replay.
        // Other constraints/write failures must roll back and be retried.
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw replay;
        throw error;
      }
      // Preserve the existing last-event guard during rollout and persist it
      // into the durable ledger. Older pre-rollout history is not reconstructible.
      if (await tx.tenantBillingPlan.findFirst({ where: { lastStripeEventId: input.lastStripeEventId }, select: { organizationId: true } })) return "replay";
      const current = await tx.tenantBillingPlan.findUnique({ where: { organizationId: input.organizationId }, select: { stripeCustomerId: true, stripeSubscriptionId: true, lastStripeEventId: true } });
      if (!sameSubscriptionBinding(current, expectedBinding)) throw new Error("subscription_snapshot_changed");
      if (current && ((current.stripeCustomerId && current.stripeCustomerId !== input.stripeCustomerId) || (current.stripeSubscriptionId && current.stripeSubscriptionId !== input.stripeSubscriptionId))) throw ownershipConflict;
      const conflict = await tx.tenantBillingPlan.findFirst({
        where: {
          organizationId: { not: input.organizationId },
          OR: [{ stripeCustomerId: input.stripeCustomerId }, { stripeSubscriptionId: input.stripeSubscriptionId }],
        },
        select: { organizationId: true },
      });
      if (conflict) throw ownershipConflict;
      const data = {
        tier: input.tier, status: input.status,
        trialEndsAt: input.trialEndsAt ?? null,
        currentPeriodEndsAt: input.currentPeriodEndsAt ?? null,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        lastStripeEventId: input.lastStripeEventId,
        seatQuantity: input.seatQuantity ?? null,
      };
      await tx.tenantBillingPlan.upsert({ where: { organizationId: input.organizationId }, update: data, create: { organizationId: input.organizationId, ...data } });
      return "applied";
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error === replay) return "replay";
    if (error === ownershipConflict) return "ownership_conflict";
    throw error;
  }
}

/** Equality only: event IDs are opaque tokens, never ordered or timestamped. */
export function sameSubscriptionBinding(left: SubscriptionBinding | null, right: SubscriptionBinding | null): boolean {
  return left === null || right === null ? left === right
    : left.stripeCustomerId === right.stripeCustomerId && left.stripeSubscriptionId === right.stripeSubscriptionId && left.lastStripeEventId === right.lastStripeEventId;
}
