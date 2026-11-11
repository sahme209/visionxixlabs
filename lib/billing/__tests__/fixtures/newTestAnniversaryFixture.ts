/** Test-only owned fixtures. All provider replies and cost inputs here are
 * synthetic; no route, credential lookup, transport or clock override exists. */
import { randomBytes, createHash } from "node:crypto";
import Stripe from "stripe";
import type { Prisma, PrismaClient } from "@/lib/prismaClient";
import { expect } from "vitest";
import { createNewTestSubscriptionService, type Intent } from "../../newTestSubscription/service";
import { postgresFixtureStore } from "../../newTestSubscription/postgresFixtureStore";
import { createStripeTestProvider } from "../../newTestSubscription/stripeTestProvider";
import { enrollFixtureAllowanceV2 } from "../../newTestSubscription/fixtureAllocation";
import { claimNewTestBillableDispatch, recordAttributedUsageV2 } from "../../newTestSubscription/usageAllocationIO";
import { settleGatewayGenerationInTransaction, type GatewayUsageTransaction } from "../../reconcileGatewayUsage";
import { newTestPrismaEnvironment } from "./newTestChildEnvironment";
import { paidFixture } from "./newTestPaidFixture";
export type OwnedAnniversaryContext = { db: PrismaClient; url: string; runtime: string; stores: Array<ReturnType<typeof postgresFixtureStore>> };
export async function assertOwnedAnniversaryContext(ctx: OwnedAnniversaryContext) {
  newTestPrismaEnvironment({}, [], ctx.url);
  if (!ctx.runtime) throw new Error("owned_runtime_required");
  const rows = await ctx.db.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2', ctx.runtime, "acct-test");
  if (rows.length !== 1) throw new Error("owned_runtime_required");
}
export const fixtureId = () => randomBytes(10).toString("hex");
export async function databaseClock(db: PrismaClient | Prisma.TransactionClient): Promise<Date> {
  const rows = await db.$queryRawUnsafe<Array<{ now: Date }>>('SELECT clock_timestamp() AS now');
  if (!(rows[0]?.now instanceof Date)) throw new Error("owned_clock_missing"); return rows[0].now;
}
export async function waitForDatabaseTime(db: PrismaClient, target: Date, maximumMs: number) {
  const deadline = performance.now() + maximumMs;
  while ((await databaseClock(db)) < target) {
    if (performance.now() >= deadline) throw new Error("owned_clock_wait_timeout");
    await new Promise<void>(resolve => setTimeout(resolve, 100));
  }
}
export function serviceBoundary(anchor: Date, n: number): Date {
  const month = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() + n, year = Math.floor(month / 12), m = month % 12;
  return new Date(Date.UTC(year, m, Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, m + 1, 0)).getUTCDate()), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds()));
}
export async function anniversaryFixture(ctx: OwnedAnniversaryContext, input: { org?: string; userId?: string; email?: string; interval?: "monthly" | "annual" } = {}) {
  await assertOwnedAnniversaryContext(ctx);
  const { db, url, runtime } = ctx, suffix = fixtureId(), organizationId = input.org ?? `v2-${suffix}`, userId = input.userId ?? `owner-${suffix}`, accountId = "acct-test";
  const actor = { organizationId, userId }, interval = input.interval ?? "monthly";
  const clock = await databaseClock(db);
  for (const id of [userId, `member2-${suffix}`, `member3-${suffix}`]) await db.orgMembership.create({ data: { organizationId, userId: id, role: id === userId ? "owner" : "read_only", acceptedAt: clock } });
  await db.$transaction(tx => enrollFixtureAllowanceV2(tx, { runtimeId: runtime, accountId, organizationId }), { isolationLevel: "Serializable" });
  const store = postgresFixtureStore(url, runtime, accountId); ctx.stores.push(store);
  const ids = { session: `cs-${suffix}`, customer: `cus-${suffix}`, subscription: `sub-${suffix}`, price: `price-${suffix}`, product: `prod-${suffix}` };
  const price = { id: ids.price, livemode: false, active: true, currency: "usd", type: "recurring", billing_scheme: "per_unit", unit_amount: interval === "annual" ? 27840 : 2900,
    recurring: { interval: interval === "annual" ? "year" : "month", interval_count: 1, usage_type: "licensed" }, product: { id: ids.product, active: true, livemode: false } };
  let anchor: Date | null = null, serviceStart: Date | null = null, serviceEnd: Date | null = null, lifecycleStatus = "active";
  let metadata: Stripe.Metadata = {}, sessionMetadata: Stripe.Metadata = {}, intent: Intent | null = null;
  let paid: ReturnType<typeof paidFixture> | null = null, created = 0;
  function collection(start: Date, end: Date, label: string) {
    serviceStart = start; serviceEnd = end;
    paid = paidFixture({ runtimeId: runtime, accountId, organizationId, sessionId: ids.session, customerId: ids.customer, subscriptionId: ids.subscription, priceId: ids.price, interval, unitAmountCents: price.unit_amount });
    Object.assign(paid.line.period, { start: start.getTime() / 1000, end: end.getTime() / 1000 }); paid.line.id = `il-${label}-${suffix}`; paid.line.pricing.price_details.product = ids.product;
    paid.invoice.id = `in-${label}-${suffix}`; Object.assign(paid.invoice.status_transitions, { finalized_at: start.getTime() / 1000, paid_at: start.getTime() / 1000 });
    paid.payment.id = `inpay-${label}-${suffix}`; paid.payment.invoice = paid.invoice.id; paid.payment.status_transitions.paid_at = start.getTime() / 1000; paid.payment.payment.payment_intent = `pi-${label}-${suffix}`;
    paid.paymentIntent.id = `pi-${label}-${suffix}`; paid.paymentIntent.latest_charge = `ch-${label}-${suffix}`; paid.charge.id = `ch-${label}-${suffix}`; paid.charge.payment_intent = paid.paymentIntent.id;
  }
  const session = () => ({ invoice: paid?.invoice.id, id: ids.session, livemode: false, mode: "subscription", status: "complete", payment_status: "paid", customer: ids.customer, subscription: ids.subscription, metadata: sessionMetadata, line_items: { has_more: false, data: [{ quantity: 3, price }] } });
  const subscription = () => {
    if (!anchor || !serviceStart || !serviceEnd || !paid) throw new Error("owned_provider_fixture_unprepared");
    return { id: ids.subscription, customer: ids.customer, livemode: false, latest_invoice: paid.invoice.id, metadata, status: lifecycleStatus, cancel_at_period_end: false,
      billing_cycle_anchor: anchor.getTime() / 1000, start_date: anchor.getTime() / 1000, billing_cycle_anchor_config: null, trial_start: null, trial_end: null,
      items: { has_more: false, data: [{ id: "si_test", quantity: 3, price, current_period_start: serviceStart.getTime() / 1000, current_period_end: serviceEnd.getTime() / 1000 }] } };
  };
  const sdk = new Stripe("sk_test_synthetic_anniversary");
  const client = { accounts: { retrieve: async () => ({ id: accountId }) }, prices: { retrieve: async () => structuredClone(price) }, subscriptions: { retrieve: async () => structuredClone(subscription()) },
    invoices: { retrieve: async () => structuredClone(paid!.invoice) }, invoicePayments: { list: async () => structuredClone(paid!.payments) }, paymentIntents: { retrieve: async () => structuredClone(paid!.paymentIntent) }, charges: { retrieve: async () => structuredClone(paid!.charge) },
    checkout: { sessions: { retrieve: async () => structuredClone(session()), create: async (request: Stripe.Checkout.SessionCreateParams, opts: Stripe.RawRequestOptions) => { created++; metadata = request.subscription_data!.metadata as Stripe.Metadata; sessionMetadata = request.metadata as Stripe.Metadata;
      return { ...session(), url: "https://checkout.stripe.com/synthetic-owned", lastResponse: { requestId: `req-synthetic-${suffix}`, statusCode: 200, idempotencyKey: opts.idempotencyKey } }; } } }, webhooks: sdk.webhooks };
  const provider = createStripeTestProvider({ secretKey: "sk_test_synthetic_anniversary", webhookSecret: "whsec_synthetic_anniversary", expectedAccountId: accountId, store, configuredPrices: { [`pro:${interval}`]: ids.price }, sdkFactory: () => client as unknown as Stripe });
  const service = createNewTestSubscriptionService({ store, provider, configuredPrices: { [`pro:${interval}`]: ids.price }, now: () => Date.now(), id: fixtureId, digest: text => createHash("sha256").update(text).digest("hex") });
  async function deliver(type = "customer.subscription.updated", event = `evt-${fixtureId()}`) {
    const object = type === "checkout.session.completed" ? session() : type.startsWith("invoice.") ? paid!.invoice : subscription();
    const raw = JSON.stringify({ id: event, type, livemode: false, data: { object } });
    return service.reconcile(raw, sdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_synthetic_anniversary" }), organizationId);
  }
  async function activate(expiredHistory = false) {
    if (!intent) {
      const before = await databaseClock(db), next = new Date(Math.floor(before.getTime() / 1000) * 1000 + 1000);
      await waitForDatabaseTime(db, next, 3000); anchor = new Date(Math.floor((await databaseClock(db)).getTime() / 1000) * 1000);
      if (expiredHistory) anchor = serviceBoundary(anchor, interval === "annual" ? -24 : -2);
      collection(anchor, serviceBoundary(anchor, interval === "annual" ? 12 : 1), "original");
      if (expiredHistory && serviceEnd! > before) throw new Error("owned_expired_fixture_not_past");
      intent = await service.prepare(actor, { clientIntentKey: `intent_${suffix}`, planId: "pro", interval, seatQuantity: 3, email: input.email ?? `v2-${suffix}@example.invalid`, successUrl: "https://isolated.invalid/success", cancelUrl: "https://isolated.invalid/cancel" });
      expect(await service.attempt(actor, intent.id)).toMatchObject({ kind: "checkout_ready" });
    }
    return deliver("checkout.session.completed", `evt-origin-${suffix}`);
  }
  async function reserve(cents: number, key = `hold_${fixtureId()}`) { const result = await store.reserveCredits(actor, { idempotencyKey: key, reservedCents: cents }, new Date()); if (!result.ok) throw new Error(result.error); return result.reservation; }
  const claim = (id: string) => db.$transaction(tx => claimNewTestBillableDispatch(tx, actor, id), { isolationLevel: "Serializable", timeout: 30000 });
  const direct = (id: string, cents: number) => db.$transaction(tx => recordAttributedUsageV2(tx, id, { organizationId, provider: "synthetic_direct", model: "synthetic_measured", inputTokens: 10, outputTokens: 20, metadata: { fixture: "synthetic_cost_not_provider_acceptance" } }, { totalCents: cents, inputCents: cents, outputCents: 0, cachedReadCents: 0, appliedBatchRate: false }), { isolationLevel: "Serializable" });
  const pending = (id: string) => db.$transaction(tx => recordAttributedUsageV2(tx, id, { organizationId, provider: "vercel_gateway", model: "synthetic_gateway", inputTokens: 10, outputTokens: 20, externalUsageId: `gen-${id}`, metadata: { fixture: "synthetic_generation_not_provider_acceptance" } }, null), { isolationLevel: "Serializable" });
  const settle = (eventId: string, holdId: string) => db.$transaction(tx => settleGatewayGenerationInTransaction(tx as unknown as GatewayUsageTransaction, { id: eventId, externalUsageId: `gen-${holdId}`, metadata: { axiomTestAllocationV2: {} } }, { id: `gen-${holdId}`, totalCost: .53, model: "synthetic_gateway", providerName: "synthetic", promptTokens: 10, completionTokens: 20, cachedTokens: 0 }), { isolationLevel: "Serializable" });
  async function purchase() { return db.addOnPurchase.create({ data: { organizationId, sku: "ai_credits_small", pricePaidCents: 500, deliveredAICreditsCents: 500, validFor: "permanent", periodMonth: (await databaseClock(db)).toISOString().slice(0, 7), status: "paid", stripePaymentIntentId: `pi-purchase-${suffix}`, idempotencyKey: `purchase-${suffix}`, purchasedBy: userId, correlationId: "synthetic-purchase-seed" } }); }
  async function exhaustFree() { const h = await reserve(200); expect(await claim(h.id)).toBe(true); await direct(h.id, 200); }
  async function inactive() { lifecycleStatus = "past_due"; paid!.invoice.status = "open"; return deliver(); }
  async function unavailable() { lifecycleStatus = "active"; paid!.invoice.status = "open"; return deliver("invoice.payment_failed"); }
  async function recover() { lifecycleStatus = "active"; collection(serviceStart!, serviceEnd!, `recovery-${fixtureId()}`); return deliver("invoice.paid"); }
  async function financial() { return { usage: await db.usageEvent.findMany({ where: { organizationId }, orderBy: { id: "asc" } }), holds: await db.aIUsageReservation.findMany({ where: { organizationId }, orderBy: { id: "asc" } }), purchases: await db.addOnPurchase.findMany({ where: { organizationId }, orderBy: { id: "asc" } }) }; }
  return { actor, store, service, ids, activate: () => activate(), activateExpiredHistory: () => activate(true), originEventId: `evt-origin-${suffix}`, deliver, reserve, claim, direct, pending, settle, purchase, exhaustFree, inactive, unavailable, recover, financial, created: () => created, intent: () => intent, period: () => ({ anchor, start: serviceStart, end: serviceEnd }) };
}
export type AnniversaryFixture = Awaited<ReturnType<typeof anniversaryFixture>>;

/** A barrier pauses around a REAL query, forwarding every SQL/arg/result.
 * It cannot rewrite scope, results, clocks or financial authority. */
export function queryGate(match: (sql: string) => boolean, phase: "before" | "after") {
  let release!: () => void, arrive!: (pid: number) => void, used = false;
  const released = new Promise<void>(resolve => { release = resolve; });
  let arrivalTimer: ReturnType<typeof setTimeout>;
  const reached = new Promise<number>((resolve, reject) => { arrive = pid => { clearTimeout(arrivalTimer); resolve(pid); }; arrivalTimer = setTimeout(() => reject(new Error("owned_query_not_reached")), 15000); });
  void reached.catch(() => {});
  const releaseGate = () => { clearTimeout(arrivalTimer); release(); };
  return { reached, release: releaseGate, async pause(sql: string, at: "before" | "after", pid: number) {
    if (used || phase !== at || !match(sql)) return; used = true; arrive(pid);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([released, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("owned_query_gate_timeout")), 15000); })]); } finally { clearTimeout(timer); }
  } };
}
export async function gatedTransaction<T>(db: PrismaClient, gate: ReturnType<typeof queryGate>, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    const pid = (await tx.$queryRawUnsafe<Array<{ pid: number }>>('SELECT pg_backend_pid() AS pid'))[0].pid;
    const forwarded = new Proxy(tx, { get(target, key) {
      if (key === "$queryRawUnsafe") return async <R>(sql: string, ...args: unknown[]): Promise<R> => { await gate.pause(sql, "before", pid); const result = await target.$queryRawUnsafe<R>(sql, ...args); await gate.pause(sql, "after", pid); return result; };
      const value: unknown = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    return operation(forwarded);
  }, { isolationLevel: "Serializable", timeout: 30000 });
}
export async function assertBlockedBy(db: PrismaClient, waiter: number, blocker: number) {
  const deadline = performance.now() + 5000;
  while (true) {
    const rows = await db.$queryRawUnsafe<Array<{ blockers: number[] }>>('SELECT pg_blocking_pids($1::int) AS blockers', waiter);
    if (rows[0]?.blockers.includes(blocker)) return;
    if (performance.now() >= deadline) throw new Error("owned_lock_wait_not_observed");
    await new Promise<void>(resolve => setTimeout(resolve, 25));
  }
}
