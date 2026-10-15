import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
const stripeIO = vi.hoisted(() => ({ retrieve: vi.fn(), options: vi.fn() }));
vi.mock("stripe", () => ({ default: class {
  constructor(_key: string, options: unknown) { stripeIO.options(options); }
  subscriptions = { retrieve: stripeIO.retrieve };
} }));
import { reconcileSubscriptionEvent, type SubscriptionReconciliationRepository, type SubscriptionTrigger } from "../reconcileSubscriptionEvent";
import type { SubscriptionBinding } from "../consumeSubscriptionEvent";

type Plan = SubscriptionBinding & { organizationId: string; tier: string; status: string; seatQuantity: number | null };
const established = (): Plan => ({ organizationId: "org_1", tier: "growth", status: "active", seatQuantity: 2, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", lastStripeEventId: "evt_prior" });
const event = (id = "evt_current"): SubscriptionTrigger => ({ id, type: "customer.subscription.updated", organizationId: "org_1", customerId: "cus_1", subscriptionId: "sub_1", livemode: false });
const price = () => ({ id: "price_pro_monthly", type: "recurring", currency: "usd", billing_scheme: "per_unit", unit_amount: 2900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } });
const items = (quantity = 3) => ({ has_more: false, data: [{ quantity, price: price() }] });
const snapshot = (overrides: Record<string, unknown> = {}) => ({ id: "sub_1", customer: "cus_1", livemode: false, metadata: { organizationId: "org_1", planId: "pro", billingInterval: "monthly" }, status: "active", cancel_at_period_end: false, current_period_end: 1_800_000_000, items: items(), ...overrides });

function database(initial: Plan | null = established()) {
  let plan = initial;
  let events = new Set<string>();
  let failCommit = false;
  const isolation: unknown[] = [];
  const repo: SubscriptionReconciliationRepository = {
    tenantBillingPlan: { findUnique: async () => plan ? { ...plan } : null },
    stripeBillingEvent: { findUnique: async (args) => events.has((args as { where: { id: string } }).where.id) ? { id: (args as { where: { id: string } }).where.id } : null },
    async $transaction(operation, options) {
      isolation.push(options);
      const stagedEvents = new Set(events);
      let stagedPlan = plan ? { ...plan } : null;
      const result = await operation({
        stripeBillingEvent: { create: async ({ data }) => {
          if (stagedEvents.has(data.id)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
          stagedEvents.add(data.id);
        } },
        tenantBillingPlan: {
          findUnique: async () => stagedPlan ? { ...stagedPlan } : null,
          findFirst: async (args) => {
            const where = (args as { where: { lastStripeEventId?: string } }).where;
            return where.lastStripeEventId && stagedPlan?.lastStripeEventId === where.lastStripeEventId ? { organizationId: "org_1" } : null;
          },
          upsert: async (args) => { stagedPlan = (args as { create: Plan }).create; return stagedPlan; },
        },
      });
      if (failCommit) throw Object.assign(new Error("SSI conflict"), { code: "P2034" });
      plan = stagedPlan; events = stagedEvents;
      return result;
    },
  };
  return { repo, plan: () => plan, events: () => events, failCommit: () => { failCommit = true; }, isolation };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AXIOM_STRIPE_MODE", "test");
  vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture_only");
  vi.stubEnv("AXIOM_LIVE_BILLING_APPROVED", "false");
});
afterEach(() => vi.unstubAllEnvs());

describe("authoritative subscription reconciliation and local equality fence", () => {
  it.each([
    ["trialing", "trialing"], ["active", "active"], ["past_due", "past_due"], ["unpaid", "past_due"],
    ["canceled", "canceled"], ["incomplete_expired", "canceled"], ["incomplete", "no_plan"], ["paused", "no_plan"],
  ])("preserves supported lifecycle mapping %s→%s from the retrieved snapshot", async (stripeStatus, status) => {
    const db = database();
    expect(await reconcileSubscriptionEvent(event(), db.repo, async () => snapshot({ status: stripeStatus }))).toBe("applied");
    expect(db.plan()).toMatchObject({ tier: "growth", status, seatQuantity: 3 });
    expect(db.isolation).toEqual([{ isolationLevel: "Serializable" }]);
  });

  it("ignores old trigger chronology and applies the current canceled snapshot, then replays without retrieval", async () => {
    const db = database();
    const lookup = vi.fn(async () => snapshot({ status: "canceled" }));
    const old = { ...event("evt_old_distinct"), created: 10, status: "active" };
    expect(await reconcileSubscriptionEvent(old, db.repo, lookup)).toBe("applied");
    expect(db.plan()).toMatchObject({ status: "canceled", lastStripeEventId: old.id });
    expect(await reconcileSubscriptionEvent(old, db.repo, lookup)).toBe("replay");
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("does not order equal timestamps or lexical event IDs", async () => {
    const db = database();
    await reconcileSubscriptionEvent({ ...event("evt_z"), created: 123 } as SubscriptionTrigger, db.repo, async () => snapshot({ items: items(4) }));
    await reconcileSubscriptionEvent({ ...event("evt_a"), created: 123 } as SubscriptionTrigger, db.repo, async () => snapshot({ items: items(2) }));
    expect(db.plan()).toMatchObject({ seatQuantity: 2, lastStripeEventId: "evt_a" });
  });

  it("rejects late stale provider IO after a newer handler commits, and permits explicit refetch retry", async () => {
    const db = database();
    let release!: (value: unknown) => void;
    const lookup = vi.fn(() => new Promise<unknown>((resolve) => { release = resolve; }));
    const slow = reconcileSubscriptionEvent(event("evt_slow"), db.repo, lookup);
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledOnce());
    await reconcileSubscriptionEvent(event("evt_new"), db.repo, async () => snapshot({ status: "canceled" }));
    release(snapshot({ status: "active" }));
    await expect(slow).rejects.toThrow("subscription_snapshot_changed");
    expect(db.plan()).toMatchObject({ status: "canceled", lastStripeEventId: "evt_new" });
    expect([...db.events()]).toEqual(["evt_new"]);
    await reconcileSubscriptionEvent(event("evt_slow"), db.repo, async () => snapshot({ status: "canceled" }));
    expect(db.plan()?.status).toBe("canceled");
    expect(db.events().size).toBe(2);
  });

  it("fences competing first bindings by row existence rather than adopting the second subscription", async () => {
    const db = database(null);
    let release!: (value: unknown) => void;
    const lookup = vi.fn(() => new Promise<unknown>((resolve) => { release = resolve; }));
    const slow = reconcileSubscriptionEvent(event("evt_first_slow"), db.repo, lookup);
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledOnce());
    await reconcileSubscriptionEvent({ ...event("evt_other"), subscriptionId: "sub_other" }, db.repo, async () => snapshot({ id: "sub_other" }));
    release(snapshot());
    await expect(slow).rejects.toThrow("subscription_snapshot_changed");
    expect(db.plan()?.stripeSubscriptionId).toBe("sub_other");
    expect(db.events().has("evt_first_slow")).toBe(false);
  });

  it.each([{ subscriptionId: "sub_old", type: "customer.subscription.deleted" }, { customerId: "cus_other" }])("refuses unexpected replacement/deletion before provider IO: %s", async (change) => {
    const db = database(); const lookup = vi.fn();
    expect(await reconcileSubscriptionEvent({ ...event(), ...change }, db.repo, lookup)).toBe("replacement_required");
    expect(lookup).not.toHaveBeenCalled(); expect(db.events().size).toBe(0);
    expect(db.plan()?.status).toBe("active");
  });

  it.each([
    { id: "sub_other" }, { customer: "cus_other" }, { metadata: { organizationId: "org_other", planId: "pro" } },
    { metadata: { organizationId: "org_1", planId: "unknown" } }, { livemode: true }, { status: "unknown" },
    { items: items(-1) }, { current_period_end: -1 }, { cancel_at_period_end: "false" },
  ])("rejects unsupported or mismatched provider snapshot without consuming the event: %s", async (change) => {
    const db = database();
    await expect(reconcileSubscriptionEvent(event(), db.repo, async () => snapshot(change))).rejects.toThrow();
    expect(db.plan()).toEqual(established()); expect(db.events().size).toBe(0);
  });

  it.each([
    { ...items(), has_more: true },
    { ...items(), data: [...items().data, ...items().data] },
    { ...items(), data: [{ quantity: 3, price: { ...price(), id: "price_other" } }] },
    { ...items(), data: [{ quantity: 3, price: { ...price(), recurring: { ...price().recurring, usage_type: "metered" } } }] },
    { ...items(), data: [{ quantity: 3, price: { ...price(), recurring: { ...price().recurring, interval: "year" } } }] },
    { ...items(), data: [{ quantity: 3, price: { ...price(), transform_quantity: { divide_by: 10 } } }] },
    { ...items(), data: [{ quantity: 3, price: { ...price(), currency: "eur" } }] },
  ])("refuses ambiguous/truncated/unapproved per-seat evidence: %s", async (badItems) => {
    const db = database();
    await expect(reconcileSubscriptionEvent(event(), db.repo, async () => snapshot({ items: badItems }))).rejects.toThrow();
    expect(db.plan()).toEqual(established()); expect(db.events().size).toBe(0);
  });

  it("rejects a deleted expanded customer and missing price configuration", async () => {
    const db = database();
    await expect(reconcileSubscriptionEvent(event(), db.repo, async () => snapshot({ customer: { id: "cus_1", deleted: true } }))).rejects.toThrow();
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "");
    await expect(reconcileSubscriptionEvent(event(), db.repo, async () => snapshot())).rejects.toThrow();
    expect(db.plan()).toEqual(established()); expect(db.events().size).toBe(0);
  });

  it.each([404, 408, 503])("retains plan and unconsumed event on provider failure %s", async (statusCode) => {
    const db = database();
    await expect(reconcileSubscriptionEvent(event(), db.repo, async () => { throw Object.assign(new Error("unavailable"), { statusCode }); })).rejects.toThrow();
    expect(db.plan()).toEqual(established()); expect(db.events().size).toBe(0);
  });

  it("does not acknowledge a serialization failure or commit either staged write", async () => {
    const db = database(); db.failCommit();
    await expect(reconcileSubscriptionEvent(event(), db.repo, async () => snapshot())).rejects.toMatchObject({ code: "P2034" });
    expect(db.plan()).toEqual(established()); expect(db.events().size).toBe(0);
  });

  it.each(["invalid", "live"])('rejects unapproved/mismatched mode "%s" before provider IO', async (mode) => {
    vi.stubEnv("AXIOM_STRIPE_MODE", mode);
    const db = database(); const lookup = vi.fn();
    await expect(reconcileSubscriptionEvent(event(), db.repo, lookup)).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled(); expect(db.events().size).toBe(0);
  });

  it("requires matching event mode even with otherwise configured test credentials", async () => {
    const db = database(); const lookup = vi.fn();
    await expect(reconcileSubscriptionEvent({ ...event(), livemode: true }, db.repo, lookup)).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled(); expect(db.events().size).toBe(0);
  });

  it("permits only explicitly approved matching live configuration using simulated IO", async () => {
    const db = database(); const lookup = vi.fn(async () => snapshot({ livemode: true }));
    vi.stubEnv("AXIOM_STRIPE_MODE", "live");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_invented_fixture_not_a_credential");
    await expect(reconcileSubscriptionEvent({ ...event(), livemode: true }, db.repo, lookup)).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
    vi.stubEnv("AXIOM_LIVE_BILLING_APPROVED", "true");
    expect(await reconcileSubscriptionEvent({ ...event(), livemode: true }, db.repo, lookup)).toBe("applied");
  });

  it("rejects a credential change while a provider response is in flight", async () => {
    const db = database();
    await expect(reconcileSubscriptionEvent(event(), db.repo, async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_changed_fixture"); return snapshot();
    })).rejects.toThrow("subscription_mode_changed");
    expect(db.events().size).toBe(0);
  });

  it("uses exact bound ID with bounded SDK retrieval and no automatic provider retry", async () => {
    const db = database(); stripeIO.retrieve.mockResolvedValue(snapshot());
    await reconcileSubscriptionEvent(event(), db.repo);
    expect(stripeIO.retrieve).toHaveBeenCalledWith("sub_1");
    expect(stripeIO.options).toHaveBeenCalledWith({ apiVersion: "2024-06-20", timeout: 10_000, maxNetworkRetries: 0 });
  });
});
