import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { consumeSubscriptionEvent, type SubscriptionBinding, type SubscriptionEventRepository } from "../consumeSubscriptionEvent";

type Transaction = Parameters<Parameters<SubscriptionEventRepository["$transaction"]>[0]>[0];
const input = { organizationId: "org_1", tier: "growth" as const, status: "active" as const, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", lastStripeEventId: "evt_A", seatQuantity: 3 };

// Stateful transactional simulator: stage both writes, commit only if callback
// succeeds. SQL/SSI semantics require separate PostgreSQL acceptance evidence.
function store() {
  let events = new Set<string>();
  let plan: Record<string, unknown> | null = null;
  let conflict = false;
  let failWrite = false;
  const options: unknown[] = [];
  const repository: SubscriptionEventRepository = {
    async $transaction(operation, option) {
      options.push(option);
      const stagedEvents = new Set(events);
      let stagedPlan = plan && { ...plan };
      const tx: Transaction = {
        stripeBillingEvent: { async create({ data }) {
          if (stagedEvents.has(data.id)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
          stagedEvents.add(data.id);
          return data;
        } },
        tenantBillingPlan: {
          async findUnique() { return stagedPlan ? { stripeCustomerId: stagedPlan.stripeCustomerId as string | null, stripeSubscriptionId: stagedPlan.stripeSubscriptionId as string | null, lastStripeEventId: stagedPlan.lastStripeEventId as string | null } : null; },
          async findFirst(args) {
            const where = (args as { where: { lastStripeEventId?: string } }).where;
            if (where.lastStripeEventId) return stagedPlan?.lastStripeEventId === where.lastStripeEventId ? { organizationId: "org_1" } : null;
            return conflict ? { organizationId: "org_other" } : null;
          },
          async upsert(args) {
            if (failWrite) throw new Error("write unavailable");
            stagedPlan = { ...(args as { create: Record<string, unknown> }).create };
            return stagedPlan;
          },
        },
      };
      const result = await operation(tx);
      events = stagedEvents;
      plan = stagedPlan;
      return result;
    },
  };
  const binding = (): SubscriptionBinding | null => plan ? {
    stripeCustomerId: plan.stripeCustomerId as string | null,
    stripeSubscriptionId: plan.stripeSubscriptionId as string | null,
    lastStripeEventId: plan.lastStripeEventId as string | null,
  } : null;
  return { repository, binding, events: () => events, plan: () => plan, conflict: (value: boolean) => { conflict = value; }, failWrite: (value: boolean) => { failWrite = value; }, options };
}

describe("durable subscription event transaction", () => {
  it("applies A then B and makes replayed A a no-op despite the last pointer changing", async () => {
    const db = store();
    expect(await consumeSubscriptionEvent("customer.subscription.updated", input, db.repository, db.binding())).toBe("applied");
    const canceled = { ...input, status: "canceled" as const, lastStripeEventId: "evt_B" };
    expect(await consumeSubscriptionEvent("customer.subscription.deleted", canceled, db.repository, db.binding())).toBe("applied");
    expect(await consumeSubscriptionEvent("customer.subscription.updated", input, db.repository, db.binding())).toBe("replay");
    expect(db.plan()).toMatchObject({ status: "canceled", lastStripeEventId: "evt_B", tier: "growth", seatQuantity: 3 });
    expect([...db.events()]).toEqual(["evt_A", "evt_B"]);
    expect(db.options).toEqual(Array(3).fill({ isolationLevel: "Serializable" }));
  });

  it("rolls back event consumption on plan-write failure so Stripe can retry", async () => {
    const db = store();
    db.failWrite(true);
    await expect(consumeSubscriptionEvent("customer.subscription.updated", input, db.repository, db.binding())).rejects.toThrow("write unavailable");
    expect(db.events().size).toBe(0);
    expect(db.plan()).toBeNull();
    db.failWrite(false);
    expect(await consumeSubscriptionEvent("customer.subscription.updated", input, db.repository, db.binding())).toBe("applied");
  });

  it("rolls back the ledger on ownership conflict and does not mutate entitlement", async () => {
    const db = store();
    db.conflict(true);
    expect(await consumeSubscriptionEvent("customer.subscription.updated", input, db.repository, db.binding())).toBe("ownership_conflict");
    expect(db.events().size).toBe(0);
    expect(db.plan()).toBeNull();
    db.conflict(false);
    expect(await consumeSubscriptionEvent("customer.subscription.updated", input, db.repository, db.binding())).toBe("applied");
  });

  it("durably adopts the current legacy last-event pointer without changing its plan", async () => {
    const db = store();
    const repository: SubscriptionEventRepository = {
      $transaction: (operation, options) => db.repository.$transaction((tx) => operation({ ...tx, tenantBillingPlan: { ...tx.tenantBillingPlan, findFirst: async () => ({ organizationId: "org_1" }), upsert: async () => { throw new Error("must not write plan"); } } }), options),
    };
    expect(await consumeSubscriptionEvent("customer.subscription.updated", input, repository, null)).toBe("replay");
    expect([...db.events()]).toEqual(["evt_A"]);
    expect(db.plan()).toBeNull();
  });

  it("propagates serialization failures so Stripe retries rather than acknowledging an unapplied event", async () => {
    const repository: SubscriptionEventRepository = { $transaction: async () => { throw Object.assign(new Error("serialization retry"), { code: "P2034" }); } };
    await expect(consumeSubscriptionEvent("customer.subscription.updated", input, repository, null)).rejects.toThrow("serialization retry");
  });

  it("does not misclassify a plan unique violation as an already consumed event", async () => {
    const db = store();
    const repository: SubscriptionEventRepository = {
      $transaction: (operation, options) => db.repository.$transaction((tx) => operation({ ...tx, tenantBillingPlan: { ...tx.tenantBillingPlan, upsert: async () => { throw Object.assign(new Error("plan conflict"), { code: "P2002" }); } } }), options),
    };
    await expect(consumeSubscriptionEvent("customer.subscription.updated", input, repository, null)).rejects.toThrow("plan conflict");
    expect(db.events().size).toBe(0);
  });
});
