import { describe, expect, it } from "vitest";
import { createPublicCheckoutService, type PublicCheckoutStore, type PublicCheckoutTransaction, type PublicCheckoutIntent, type PublicCheckoutContract, type PublicCheckoutProvider } from "../publicCheckoutService";

function fixture() {
  let intent: PublicCheckoutIntent | null = null, contract: PublicCheckoutContract | null = null;
  let member = true, seats = 2, legacy = false, calls = 0, loseResponse = false;
  let lock = Promise.resolve();
  const events = new Set<string>();
  const tx: PublicCheckoutTransaction = {
    eligibility: async () => ({ manager: member, acceptedSeats: seats, legacyBinding: legacy && !contract }),
    intent: async () => intent ? structuredClone(intent) : null,
    activeIntent: async () => intent && intent.state !== "expired" ? structuredClone(intent) : null,
    putIntent: async (next, expected) => { if ((intent?.revision ?? null) !== expected) throw Error("intent_changed"); intent = structuredClone(next); },
    contract: async () => contract ? structuredClone(contract) : null,
    fulfill: async (next, expected, eventId) => { if ((contract?.revision ?? null) !== expected) throw Error("contract_changed"); contract = structuredClone(next); events.add(eventId); },
    eventSeen: async id => events.has(id),
  };
  const store: PublicCheckoutStore = { transaction: async fn => {
    const before = lock; let release!: () => void; lock = new Promise<void>(resolve => { release = resolve; }); await before;
    const oldIntent = intent && structuredClone(intent), oldContract = contract && structuredClone(contract), oldEvents = new Set(events);
    try { return await fn(tx); } catch (error) { intent = oldIntent; contract = oldContract; events.clear(); oldEvents.forEach(v => events.add(v)); throw error; } finally { release(); }
  } };
  const provider: PublicCheckoutProvider = {
    identity: () => ({ accountId: "acct_fixture", livemode: false }),
    price: async () => ({ id: "price_pro", product: { id: "prod_pro", active: true, livemode: false }, active: true, livemode: false, type: "recurring", currency: "usd", billing_scheme: "per_unit", unit_amount: 2900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } }),
    create: async (request, key) => { calls++; if (loseResponse) throw Error("lost_response"); return { sessionId: "cs_test_fixture", url: "https://checkout.stripe.com/c/pay/cs_test_fixture", accountId: "acct_fixture", livemode: false, requestId: "req_fixture", statusCode: 200, providerKey: key, requestDigest: request.digest, expiresAt: "2026-10-23T10:00:00.000Z" }; },
    session: async () => ({ id: "cs_test_fixture", status: "open", livemode: false, subscription: null, customer: null, payment_status: "unpaid", url: "https://checkout.stripe.com/c/pay/cs_test_fixture", metadata: { intentId: intent?.id, organizationId: "org_fixture", billingPolicy: "axiom_public_anniversary_v1" } }),
  };
  let sequence = 0;
  const service = createPublicCheckoutService({ store, provider, configuredPrices: { "pro:monthly": "price_pro" }, now: () => new Date("2026-10-22T12:00:00Z"), id: () => `id_${++sequence}` });
  const scope = { organizationId: "org_fixture", userId: "owner_fixture" };
  const input = { planId: "pro" as const, interval: "monthly" as const, email: "owner@example.invalid", successUrl: "https://app.example.invalid/control/usage-billing?billing=success", cancelUrl: "https://app.example.invalid/plans?checkout=canceled" };
  return { service, scope, input, store, getIntent: () => intent, getContract: () => contract, calls: () => calls, setMember: (v: boolean) => { member = v; }, setLegacy: (v: boolean) => { legacy = v; }, setSeats: (v: number) => { seats = v; }, lose: () => { loseResponse = true; }, provider };
}

describe("public recurring Checkout durable admission", () => {
  it("persists a stable intent and original receipt before returning the payment URL", async () => {
    const f = fixture(); const result = await f.service.checkout(f.scope, f.input);
    expect(result).toMatchObject({ kind: "checkout_ready", url: "https://checkout.stripe.com/c/pay/cs_test_fixture" });
    expect(f.calls()).toBe(1);
    expect(f.getIntent()).toMatchObject({ state: "confirmed", organizationId: "org_fixture", paidSeats: 2, unitAmountCents: 2900, sessionId: "cs_test_fixture" });
    expect(f.getIntent()?.originalCreateProofDigest).toMatch(/^[a-f0-9]{64}$/);
  });
  it("two concurrent clicks dispatch one provider request", async () => {
    const f = fixture(); await Promise.allSettled([f.service.checkout(f.scope, f.input), f.service.checkout(f.scope, f.input)]);
    expect(f.calls()).toBe(1);
  });
  it("a lost provider response stays held across a new click", async () => {
    const f = fixture(); f.lose();
    expect(await f.service.checkout(f.scope, f.input)).toEqual({ kind: "reconciliation_required" });
    expect(await f.service.checkout(f.scope, f.input)).toEqual({ kind: "reconciliation_required" });
    expect(f.calls()).toBe(1); expect(f.getIntent()?.state).toBe("unknown");
  });
  it("a confirmed repeated click reuses the verified session without another subscription", async () => {
    const f = fixture(); await f.service.checkout(f.scope, f.input);
    expect(await f.service.checkout(f.scope, f.input)).toMatchObject({ kind: "checkout_ready" }); expect(f.calls()).toBe(1);
  });
  it("rejects seat drift without starting a second purchase", async () => {
    const f = fixture(); await f.service.checkout(f.scope, f.input); f.setSeats(3);
    await expect(f.service.checkout(f.scope, f.input)).rejects.toThrow("unresolved_purchase_exists"); expect(f.calls()).toBe(1);
  });
  it("rejects manager removal before provider dispatch", async () => {
    const f = fixture(); f.setMember(false);
    await expect(f.service.checkout(f.scope, f.input)).rejects.toThrow("billing_manager_required"); expect(f.calls()).toBe(0);
  });
  it("preserves an existing legacy subscription", async () => {
    const f = fixture(); f.setLegacy(true);
    await expect(f.service.checkout(f.scope, f.input)).rejects.toThrow("existing_customer_unchanged"); expect(f.calls()).toBe(0);
  });
  it("will not return a stale URL if access is revoked while Stripe responds", async () => {
    const f = fixture(), original = f.provider.create;
    f.provider.create = async (...args) => { const result = await original(...args); f.setMember(false); return result; };
    expect(await f.service.checkout(f.scope, f.input)).toEqual({ kind: "reconciliation_required" });
    expect(f.getIntent()?.state).toBe("confirmed"); expect(f.calls()).toBe(1);
  });
  it("retires only a canonically expired unpaid session without issuing a replacement automatically",async()=>{
    const f=fixture();await f.service.checkout(f.scope,f.input);
    f.provider.session=async()=>({id:'cs_test_fixture',status:'expired',livemode:false,subscription:null,payment_status:'unpaid',metadata:{intentId:f.getIntent()?.id,organizationId:'org_fixture',billingPolicy:'axiom_public_anniversary_v1'}});
    expect(await f.service.checkout(f.scope,f.input)).toEqual({kind:'checkout_expired'});
    expect(f.getIntent()?.state).toBe('expired');expect(f.calls()).toBe(1);
  });
  it("never retires an expired session that has a subscription or paid funds",async()=>{
    const f=fixture();await f.service.checkout(f.scope,f.input);
    f.provider.session=async()=>({id:'cs_test_fixture',status:'expired',livemode:false,subscription:'sub_unknown',payment_status:'paid',metadata:{intentId:f.getIntent()?.id,organizationId:'org_fixture',billingPolicy:'axiom_public_anniversary_v1'}});
    expect(await f.service.checkout(f.scope,f.input)).toEqual({kind:'reconciliation_required'});
    expect(f.getIntent()?.state).toBe('confirmed');expect(f.calls()).toBe(1);
  });
  it("rejects a wrong-priced product before creating checkout", async () => {
    const f = fixture(), original = f.provider.price;
    f.provider.price = async (...args) => ({ ...await original(...args) as object, unit_amount: 499 });
    await expect(f.service.checkout(f.scope, f.input)).rejects.toThrow("public_price_mismatch"); expect(f.calls()).toBe(0);
  });
});
