import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
type Owner = { id: string; deadline: number; closed: boolean; cancel: Set<(error: Error) => void> };
const owners = new AsyncLocalStorage<Owner>();
const active = new Map<string, Owner>();
export const internalDeadlineHeader = "X-Axiom-Internal-Deadline";
export const currentStripeDeadline = () => owners.getStore();
const expired = () => Object.assign(new Error("stripe_hard_deadline"), { code: "ETIMEDOUT" });
export function stripeDeadlineOptions(timeout: number): Stripe.RawRequestOptions {
  const owner = owners.getStore();
  if (owner?.closed) throw expired();
  return { timeout, maxNetworkRetries: 0, ...(owner ? { additionalHeaders: { [internalDeadlineHeader]: owner.id } } : {}) };
}
export function stripeDeadlineFromHeaders(headers: object): Owner {
  const tokens = Object.entries(headers).filter(([key]) => key.toLowerCase() === internalDeadlineHeader.toLowerCase());
  const owner = tokens.length === 1 && typeof tokens[0][1] === "string" ? active.get(tokens[0][1]) : undefined;
  if (!owner || owner.closed || performance.now() >= owner.deadline) throw expired();
  return owner;
}
/** Deadline owns cancellation and forbids late transport starts. It is not an
 * IO permit: application/runtime/managed-configuration guards remain absolute. */
export function withOwnedStripeDeadline<T>(deadline: number, operation: () => Promise<T>): Promise<T> {
  const owner: Owner = { id: randomUUID(), deadline, closed: false, cancel: new Set() };
  active.set(owner.id, owner);
  return new Promise((resolve, reject) => {
    let settled = false;
    const close = (error: Error) => { owner.closed = true; active.delete(owner.id); for (const cancel of [...owner.cancel]) cancel(error); owner.cancel.clear(); };
    const timer = setTimeout(() => { if (settled) return; settled = true; const error = expired(); close(error); reject(error); }, Math.max(0, Math.floor(deadline - performance.now())));
    let pending: Promise<T>;
    try { pending = owners.run(owner, operation); }
    catch (error) { settled = true; clearTimeout(timer); close(error as Error); reject(error); return; }
    pending.then(value => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (performance.now() >= deadline || owner.cancel.size) { const error = expired(); close(error); reject(error); return; }
      owner.closed = true; active.delete(owner.id); resolve(value);
    }, error => { if (settled) return; settled = true; clearTimeout(timer); close(error as Error); reject(error); });
  });
}
