import type { Intent } from "./service";
import type { BillingStatus } from "../tierCatalog";

export type LifecycleEventType = "customer.subscription.created" | "customer.subscription.updated" | "customer.subscription.deleted";
export type SubscriptionObservation = { eventType: "checkout.session.completed" | LifecycleEventType; currentPeriodEndsAt: string | null; cancelAtPeriodEnd: boolean };
export function isLifecycleEventType(type: string): type is LifecycleEventType {
  return ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(type);
}
export function lifecycleObservation(status: string, period: unknown, cancel: unknown): { status: BillingStatus; currentPeriodEndsAt: string; cancelAtPeriodEnd: boolean } {
  const states: Record<string, BillingStatus> = { active: "active", trialing: "trialing", past_due: "past_due", unpaid: "past_due", canceled: "canceled", incomplete_expired: "canceled", incomplete: "no_plan", paused: "no_plan" };
  if (!Object.prototype.hasOwnProperty.call(states, status) || typeof cancel !== "boolean" || typeof period !== "number" || !Number.isSafeInteger(period) || period <= 0 || !Number.isFinite(new Date(period * 1000).getTime())) throw new Error("subscription_snapshot_invalid");
  return { status: states[status], currentPeriodEndsAt: new Date(period * 1000).toISOString(), cancelAtPeriodEnd: cancel };
}
export function hasOriginalCreateProof(i: Intent): boolean {
  const p = i.originalCreateProof;
  return !!p && !!i.sessionId && p.sessionId === i.sessionId && p.accountId === i.accountId && p.runtimeId === i.runtimeId
    && p.outboundRequestKey === i.providerIdempotencyKey && p.outboundRequestDigest === i.requestDigest
    && typeof p.requestId === "string" && !!p.requestId.trim() && Number.isInteger(p.statusCode) && p.statusCode >= 200 && p.statusCode < 300
    && (p.observedIdempotencyKey === undefined || p.observedIdempotencyKey === i.providerIdempotencyKey)
    && (p.observedAccountId === undefined || p.observedAccountId === i.accountId);
}
