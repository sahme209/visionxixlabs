import "server-only";
import { prisma } from "@/lib/db";
import type { BillingStatus } from "./tierCatalog";
import { isBillingInterval, isPaidPublicPlanId, legacyEntitlementTierForPublicPlan, stripePriceEnvKey } from "./publicPlanCatalog";
import { consumeSubscriptionEvent, type SubscriptionBinding, type SubscriptionEventRepository } from "./consumeSubscriptionEvent";

export interface SubscriptionTrigger {
  id: string;
  type: string;
  organizationId: string;
  customerId: string;
  subscriptionId: string;
  livemode: boolean;
}
export interface SubscriptionReconciliationRepository extends SubscriptionEventRepository {
  tenantBillingPlan: { findUnique(args: unknown): Promise<SubscriptionBinding | null> };
  stripeBillingEvent: { findUnique(args: unknown): Promise<{ id: string } | null> };
}
export type SubscriptionLookup = (id: string) => Promise<unknown>;

function approvedMode(): boolean {
  const mode = process.env.AXIOM_STRIPE_MODE?.trim().toLowerCase();
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (mode === "test" && key.startsWith("sk_test_")) return false;
  if (mode === "live" && key.startsWith("sk_live_") && process.env.AXIOM_LIVE_BILLING_APPROVED === "true") return true;
  throw new Error("subscription_mode_unavailable");
}
const retrieveSubscription: SubscriptionLookup = async (id) => {
  type Constructor = new (key: string, options: unknown) => { subscriptions: { retrieve(id: string): Promise<unknown> } };
  const Stripe = (await import("stripe")).default as unknown as Constructor;
  // Preserve the existing subscription payload contract. No transport retry can
  // silently extend the observation interval; failures remain unconsumed.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), { apiVersion: "2024-06-20", timeout: 10_000, maxNetworkRetries: 0 });
  return stripe.subscriptions.retrieve(id);
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("subscription_snapshot_invalid");
  return value as Record<string, unknown>;
};
function statusFrom(value: unknown): BillingStatus {
  switch (value) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due": case "unpaid": return "past_due";
    case "canceled": case "incomplete_expired": return "canceled";
    case "incomplete": case "paused": return "no_plan";
    default: throw new Error("subscription_snapshot_invalid");
  }
}

/** Signed events trigger current-state retrieval, not chronological payload application. */
export async function reconcileSubscriptionEvent(
  trigger: SubscriptionTrigger,
  repository: SubscriptionReconciliationRepository = prisma,
  lookup: SubscriptionLookup = retrieveSubscription,
): Promise<"applied" | "replay" | "ownership_conflict" | "replacement_required"> {
  const live = approvedMode();
  const observedKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (![trigger.id, trigger.organizationId, trigger.customerId, trigger.subscriptionId].every((value) => typeof value === "string" && value.trim().length > 0)) throw new Error("subscription_event_invalid");
  if (trigger.livemode !== live || !["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(trigger.type)) throw new Error("subscription_event_invalid");
  if (await repository.stripeBillingEvent.findUnique({ where: { id: trigger.id }, select: { id: true } })) return "replay";
  // Capture primitives before IO: a mutable adapter return cannot update our fence.
  const row = await repository.tenantBillingPlan.findUnique({ where: { organizationId: trigger.organizationId }, select: { stripeCustomerId: true, stripeSubscriptionId: true, lastStripeEventId: true } });
  const binding = row ? { ...row } : null;
  if (binding && ((binding.stripeCustomerId && binding.stripeCustomerId !== trigger.customerId) || (binding.stripeSubscriptionId && binding.stripeSubscriptionId !== trigger.subscriptionId))) return "replacement_required";
  const subscriptionId = binding?.stripeSubscriptionId ?? trigger.subscriptionId;
  const snapshot = record(await lookup(subscriptionId));
  const customer = typeof snapshot.customer === "string" ? { id: snapshot.customer } : record(snapshot.customer);
  if (customer.deleted === true) throw new Error("subscription_snapshot_invalid");
  const customerId = customer.id;
  const metadata = record(snapshot.metadata);
  const planId = metadata.planId;
  if (snapshot.id !== subscriptionId || customerId !== trigger.customerId || metadata.organizationId !== trigger.organizationId || snapshot.livemode !== live || typeof planId !== "string" || !isPaidPublicPlanId(planId)) throw new Error("subscription_snapshot_invalid");
  const status = statusFrom(snapshot.status);
  if (typeof snapshot.cancel_at_period_end !== "boolean") throw new Error("subscription_snapshot_invalid");
  // Canonical Checkout creates one recurring licensed per-seat line. Mixed,
  // metered, transformed or truncated items cannot be interpreted as seats.
  const interval = metadata.billingInterval;
  if (typeof interval !== "string" || !isBillingInterval(interval)) throw new Error("subscription_snapshot_invalid");
  const items = record(snapshot.items);
  if (items.has_more !== false || !Array.isArray(items.data) || items.data.length !== 1) throw new Error("subscription_snapshot_invalid");
  const item = record(items.data[0]);
  const price = record(item.price);
  const recurring = record(price.recurring);
  const expectedPrice = process.env[stripePriceEnvKey(planId, interval)]?.trim();
  if (!expectedPrice || price.id !== expectedPrice || price.type !== "recurring" || price.currency !== "usd" || price.billing_scheme !== "per_unit" || price.transform_quantity != null || recurring.usage_type !== "licensed" || recurring.interval !== (interval === "monthly" ? "month" : "year") || recurring.interval_count !== 1 || !Number.isSafeInteger(price.unit_amount) || (price.unit_amount as number) < 1) throw new Error("subscription_snapshot_invalid");
  const quantity = item.quantity;
  if (!Number.isSafeInteger(quantity) || (quantity as number) < 1) throw new Error("subscription_snapshot_invalid");
  const periodEnd = snapshot.current_period_end;
  if (periodEnd != null && (!Number.isSafeInteger(periodEnd) || (periodEnd as number) <= 0 || !Number.isFinite(new Date((periodEnd as number) * 1000).getTime()))) throw new Error("subscription_snapshot_invalid");
  if (approvedMode() !== live || process.env.STRIPE_SECRET_KEY?.trim() !== observedKey) throw new Error("subscription_mode_changed");
  return consumeSubscriptionEvent(trigger.type, {
    organizationId: trigger.organizationId,
    tier: legacyEntitlementTierForPublicPlan(planId),
    status,
    trialEndsAt: null,
    currentPeriodEndsAt: periodEnd == null ? null : new Date((periodEnd as number) * 1000),
    stripeCustomerId: customerId as string,
    stripeSubscriptionId: subscriptionId,
    cancelAtPeriodEnd: snapshot.cancel_at_period_end,
    lastStripeEventId: trigger.id,
    seatQuantity: quantity as number,
  }, repository, binding);
}
