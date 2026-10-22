import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { enrollNewPublicWorkspace } from "../publicFreeEnrollment";
import { createPublicSqlStore, type PublicSql } from "../publicBillingStore";
import { createPublicCheckoutService, type PublicCheckoutProvider } from "../publicCheckoutService";
import { reserveAICredits, claimLegacyAICreditDispatch } from "../aiCreditReservation";
import { readBillingPlanWithAvailability } from "../tenantBillingStore";
import { readCurrentAIAllowance } from "../currentAIAllowance";
import type { Prisma, PrismaClient } from "@prisma/client";
import { publicPaymentFixture } from "./fixtures/publicPayment";
import { observePublicSubscription } from "../publicSubscriptionEvidence";
import { readPublicCreditAllowance, reservePublicCredits, claimPublicCreditDispatch } from "../publicCreditAuthority";

type Pg = { exec(sql: string): Promise<unknown>; query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>; transaction<T>(f: (tx: Pg) => Promise<T>): Promise<T>; close(): Promise<void> };
const modulePath = process.env.AXIOM_PGLITE_TEST_MODULE;
const sql = readFileSync(new URL("../../../ops/recovery/20261022_public_billing_v1.sql", import.meta.url), "utf8");
function adapter(p: Pg): PublicSql {
  return { $queryRawUnsafe: async <T>(query: string, ...values: unknown[]) => (await p.query(query, values)).rows as T,
    $executeRawUnsafe: async (query, ...values) => (await p.query(query, values)).affectedRows ?? 0 };
}
import { publicBillingTestSchema as baseline } from "./fixtures/publicBillingDatabase";

describe.skipIf(!modulePath)("public billing real isolated PostgreSQL storage", () => {
  let db: Pg;
  beforeEach(async () => {
    vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY","axiom_public_anniversary_v1");
    vi.stubEnv("AXIOM_STRIPE_ACCOUNT_ID","acct_fixture");
    vi.stubEnv("AXIOM_STRIPE_MODE","test");
    const databaseModule = await import(/* @vite-ignore */ pathToFileURL(modulePath!).href);
    db = new databaseModule.PGlite() as Pg;
    await db.exec(baseline); await db.exec(sql);
  });
  afterEach(async () => { await db?.close(); vi.unstubAllEnvs(); });
  function fixture() {
    const store = createPublicSqlStore({ $transaction: fn => db.transaction(tx => fn(adapter(tx))) });
    let calls = 0, sequence = 0;
    const payment = publicPaymentFixture();
    const provider: PublicCheckoutProvider = {
      identity: () => ({ accountId: "acct_fixture", livemode: false }),
      price: async () => ({ id: "price_pro", product: { id: "prod_pro", active: true, livemode: false }, active: true, livemode: false, type: "recurring", currency: "usd", billing_scheme: "per_unit", unit_amount: 2900, recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } }),
      create: async (request, key) => { calls++; return { sessionId: "cs_fixture", url: "https://checkout.stripe.com/c/pay/cs_fixture", accountId: "acct_fixture", livemode: false, requestId: "req_fixture", statusCode: 200, providerKey: key, requestDigest: request.digest, expiresAt: new Date(Date.now()+3600000).toISOString() }; },
      session: async () => ({ id: "cs_fixture", status: "open", livemode: false, subscription: null, payment_status: "unpaid", url: "https://checkout.stripe.com/c/pay/cs_fixture", metadata: { intentId: "id_1", organizationId: "org", billingPolicy: "axiom_public_anniversary_v1" } }),
      observe: async intent => {
        const binding = { ...payment.binding, enrollmentId: intent.enrollmentId, organizationId: intent.organizationId, intentId: intent.id, contractId: `contract_${intent.id}`, sessionId: intent.sessionId!, originalCreateProofDigest: intent.originalCreateProofDigest!, paidSeats: intent.paidSeats };
        payment.subscription.metadata = { ...payment.subscription.metadata, organizationId: intent.organizationId, intentId: intent.id };
        payment.subscription.items.data[0].quantity = intent.paidSeats;
        payment.invoice.lines.data[0].quantity = intent.paidSeats;
        const total = intent.paidSeats * intent.unitAmountCents;
        Object.assign(payment.invoice, { amount_paid: total, amount_due: total, subtotal: total, total });
        payment.invoice.lines.data[0].amount = total;
        Object.assign(payment.payment, { amount: total, amount_received: total });
        Object.assign(payment.charge, { amount: total, amount_captured: total });
        const observation=observePublicSubscription(binding, payment, payment.now);
        return { binding, observation, initialCollection: observation.kind==="collected"?observation.coverage:null };
      },
    };
    const service = createPublicCheckoutService({ store, provider, configuredPrices: { "pro:monthly": "price_pro" }, now: () => payment.now, id: () => `id_${++sequence}` });
    return { store, service, provider, payment, calls: () => calls };
  }
  const input = { planId: "pro" as const, interval: "monthly" as const, email: "owner@example.invalid", successUrl: "https://app.example.invalid/success", cancelUrl: "https://app.example.invalid/cancel" };
  it("runs checkout through real transactions and stores exactly one original receipt", async () => {
    const f = fixture();
    expect(await f.service.checkout({ organizationId: "org", userId: "owner" }, input)).toMatchObject({ kind: "checkout_ready" });
    expect(await f.service.checkout({ organizationId: "org", userId: "owner" }, input)).toMatchObject({ kind: "checkout_ready" });
    expect(f.calls()).toBe(1);
    const rows = await db.query<{ body: { paidSeats: number; state: string } }>('SELECT body FROM "PublicCheckoutIntent"');
    expect(rows.rows).toHaveLength(1); expect(rows.rows[0].body).toMatchObject({ paidSeats: 2, state: "confirmed" });
    await expect(db.exec(`UPDATE "PublicCheckoutIntent" SET body=jsonb_set(body,'{paidSeats}','999'),revision=revision+1`)).rejects.toThrow();
  });
  it("rejects a member and leaves no enrollment or provider dispatch", async () => {
    const f = fixture();
    await expect(f.service.checkout({ organizationId: "org", userId: "member" }, input)).rejects.toThrow("billing_manager_required");
    expect(f.calls()).toBe(0); expect((await db.query('SELECT * FROM "PublicBillingEnrollment"')).rows).toHaveLength(0);
  });
  it("preserves a legacy customer without enrolling or repricing it", async () => {
    await db.exec(`INSERT INTO "TenantBillingPlan" ("organizationId",tier,status,"stripeCustomerId","stripeSubscriptionId") VALUES ('org','growth','active','cus_legacy','sub_legacy')`);
    const f = fixture();
    await expect(f.service.checkout({ organizationId: "org", userId: "owner" }, input)).rejects.toThrow("existing_customer_unchanged");
    expect(f.calls()).toBe(0); expect((await db.query('SELECT * FROM "PublicBillingEnrollment"')).rows).toHaveLength(0);
  });
  it("does not enroll while an older unknown AI charge is unreconciled", async () => {
    await db.exec(`INSERT INTO "AIUsageReservation" (id,"organizationId","idempotencyKey","reservedCents",status,"expiresAt") VALUES ('old','org','oldkey',100,'dispatch_unknown',now()-interval '1 day')`);
    const f = fixture();
    await expect(f.service.checkout({ organizationId: "org", userId: "owner" }, input)).rejects.toThrow("legacy_ai_reconciliation_required");
    expect(f.calls()).toBe(0);
  });
  it("fulfills a collected subscription once and grants exactly the paid per-seat pool", async () => {
    await db.exec(`INSERT INTO "UsageEvent" (id,"organizationId","eventKind","billedCents") VALUES ('oldfree','org','ai_invocation',190)`);
    const f=fixture(); await f.service.checkout({organizationId:'org',userId:'owner'},input);
    const evt={id:'evt_paid',type:'invoice.paid',objectId:'in_fixture'};
    expect(await f.service.reconcile('id_1',evt)).toBe('applied');
    expect(await f.service.reconcile('id_1',evt)).toBe('replay');
    const allowance=await readPublicCreditAllowance(adapter(db),'org',f.provider.identity(),f.payment.now);
    expect(allowance).toMatchObject({available:true,baseCents:2000,poolCents:2000,usedCents:0,includedRemainingCents:2000});
    expect((await db.query('SELECT * FROM "PublicInvoiceCollection"')).rows).toHaveLength(1);
    const a=await db.transaction(tx=>reservePublicCredits(adapter(tx),{organizationId:'org',idempotencyKey:'public_reserve_key_123',reservedCents:1000},f.provider.identity(),f.payment.now));
    expect(a).toMatchObject({ok:true,reused:false,allocationPolicy:'axiom_public_anniversary_v1'});
    const b=await db.transaction(tx=>reservePublicCredits(adapter(tx),{organizationId:'org',idempotencyKey:'public_reserve_key_123',reservedCents:1000},f.provider.identity(),f.payment.now));
    expect(b).toMatchObject({ok:true,reused:true});
    expect(await readPublicCreditAllowance(adapter(db),'org',f.provider.identity(),f.payment.now)).toMatchObject({heldCents:1000,includedRemainingCents:1000});
  });
  it("does not grant paid access for an active but uncollected subscription",async()=>{
    const f=fixture();await f.service.checkout({organizationId:'org',userId:'owner'},input);f.payment.invoice.paid=false;
    expect(await f.service.reconcile('id_1',{id:'evt_unpaid',type:'invoice.paid',objectId:'in_fixture'})).toBe('awaiting_collection');
    expect((await db.query('SELECT * FROM "PublicSubscriptionContract"')).rows).toHaveLength(0);
    expect(await readPublicCreditAllowance(adapter(db),'org',f.provider.identity(),f.payment.now)).toMatchObject({baseCents:200});
  });
  it("revokes paid funding on refund and never reactivates it from an older event",async()=>{
    const f=fixture();await f.service.checkout({organizationId:'org',userId:'owner'},input);
    await f.service.reconcile('id_1',{id:'evt_paid',type:'invoice.paid',objectId:'in_fixture'});
    f.payment.charge.amount_refunded=100;
    expect(await f.service.reconcile('id_1',{id:'evt_refund',type:'charge.refunded',objectId:'ch_fixture'})).toBe('applied');
    expect(await readPublicCreditAllowance(adapter(db),'org',f.provider.identity(),f.payment.now)).toEqual({available:false});
    expect(await f.service.reconcile('id_1',{id:'evt_old',type:'customer.subscription.updated',objectId:'sub_fixture'})).toBe('applied');
    expect(await readPublicCreditAllowance(adapter(db),'org',f.provider.identity(),f.payment.now)).toEqual({available:false});
    expect((await db.query('SELECT * FROM "PublicInvoiceCollection"')).rows).toHaveLength(1);
  });
  it("checks fresh membership and paid coverage before granting dispatch",async()=>{
    const f=fixture();await f.service.checkout({organizationId:'org',userId:'owner'},input);
    await f.service.reconcile('id_1',{id:'evt_paid',type:'invoice.paid',objectId:'in_fixture'});
    const r=await db.transaction(tx=>reservePublicCredits(adapter(tx),{organizationId:'org',idempotencyKey:'public_reserve_key_456',reservedCents:1000},f.provider.identity(),f.payment.now));
    if(!r?.ok)throw Error('reserve failed');
    await db.exec(`DELETE FROM "OrgMembership" WHERE "userId"='owner'`);
    expect(await db.transaction(tx=>claimPublicCreditDispatch(adapter(tx),{organizationId:'org',userId:'owner'},r.reservation.id,f.provider.identity(),f.payment.now))).toBe(false);
    expect(await db.transaction(tx=>claimPublicCreditDispatch(adapter(tx),{organizationId:'org',userId:'member'},r.reservation.id,f.provider.identity(),f.payment.now))).toBe(true);
    expect(await db.transaction(tx=>claimPublicCreditDispatch(adapter(tx),{organizationId:'org',userId:'member'},r.reservation.id,f.provider.identity(),f.payment.now))).toBe(false);
  });
  it("mounts paid credit authority in the actual allowance, reservation and dispatch entry points",async()=>{
    const f=fixture();await f.service.checkout({organizationId:'org',userId:'owner'},input);
    await f.service.reconcile('id_1',{id:'evt_paid',type:'invoice.paid',objectId:'in_fixture'});
    const repo={$transaction:<T>(fn:(tx:PublicSql)=>Promise<T>)=>db.transaction(tx=>fn(adapter(tx)))};
    const r=await reserveAICredits(repo as unknown as Parameters<typeof reserveAICredits>[0],{organizationId:'org',idempotencyKey:'entry_point_test_123',reservedCents:1000});
    expect(r).toMatchObject({ok:true,allocationPolicy:'axiom_public_anniversary_v1'});if(!r.ok)throw Error('reserve');
    expect(await readCurrentAIAllowance(repo as unknown as Pick<PrismaClient,'$transaction'>,'org')).toMatchObject({available:true,baseCents:2000,heldCents:1000,includedRemainingCents:1000});
    expect(await db.transaction(tx=>claimLegacyAICreditDispatch(adapter(tx) as unknown as Prisma.TransactionClient,{organizationId:'org',userId:'owner'},r.reservation.id))).toBe(true);
  });
  it("the actual account plan reader reports paid seats/credits and revokes a canceled contract",async()=>{
    const f=fixture();await f.service.checkout({organizationId:'org',userId:'owner'},input);
    await f.service.reconcile('id_1',{id:'evt_paid',type:'invoice.paid',objectId:'in_fixture'});
    const repo={$transaction:<T>(fn:(tx:PublicSql)=>Promise<T>)=>db.transaction(tx=>fn(adapter(tx)))};
    expect(await readBillingPlanWithAvailability('org',repo as never)).toMatchObject({available:true,plan:{publicPlanId:'pro',status:'active',seatQuantity:2,spec:{label:'Pro'},pricingPlan:{entitlements:{includedAICreditsCents:2000,maxUsers:2,overagePolicy:'hard_stop'}}}});
    f.payment.subscription.status='canceled';
    await f.service.reconcile('id_1',{id:'evt_canceled',type:'customer.subscription.deleted',objectId:'sub_fixture'});
    expect(await readBillingPlanWithAvailability('org',repo as never)).toMatchObject({available:true,plan:{publicPlanId:'pro',status:'canceled',pricingPlan:{entitlements:{includedAICreditsCents:0,maxUsers:0}}}});
  });
  it("enrolls a new Free workspace without creating a Stripe purchase",async()=>{
    expect(await db.transaction(tx=>enrollNewPublicWorkspace(adapter(tx),'org',{accountId:'acct_fixture',livemode:false}))).toBe(true);
    expect(await readPublicCreditAllowance(adapter(db),'org',{accountId:'acct_fixture',livemode:false},new Date())).toMatchObject({available:true,baseCents:200,poolCents:200});
    expect((await db.query('SELECT * FROM "PublicCheckoutIntent"')).rows).toHaveLength(0);
    expect(await db.transaction(tx=>enrollNewPublicWorkspace(adapter(tx),'org',{accountId:'acct_fixture',livemode:false}))).toBe(false);
  });
  it("does not automatically convert legacy workspace billing during free enrollment",async()=>{
    await db.exec(`INSERT INTO "TenantBillingPlan" ("organizationId",tier,status) VALUES ('org','growth','active')`);
    expect(await db.transaction(tx=>enrollNewPublicWorkspace(adapter(tx),'org',{accountId:'acct_fixture',livemode:false}))).toBe(false);
    expect((await db.query('SELECT * FROM "PublicBillingEnrollment"')).rows).toHaveLength(0);
  });
  it("refuses dispatch after workspace membership grows beyond paid seats",async()=>{
    const f=fixture();await f.service.checkout({organizationId:'org',userId:'owner'},input);await f.service.reconcile('id_1',{id:'evt_paid',type:'invoice.paid',objectId:'in_fixture'});
    const r=await db.transaction(tx=>reservePublicCredits(adapter(tx),{organizationId:'org',idempotencyKey:'seat_dispatch_test_123',reservedCents:100},f.provider.identity(),f.payment.now));if(!r?.ok)throw Error('reserve');
    await db.exec(`INSERT INTO "OrgMembership" VALUES ('extra','org','member',now())`);
    expect(await db.transaction(tx=>claimPublicCreditDispatch(adapter(tx),{organizationId:'org',userId:'owner'},r.reservation.id,f.provider.identity(),f.payment.now))).toBe(false);
  });
  it("preserves a legacy manually entitled workspace without Stripe IDs",async()=>{
    await db.exec(`INSERT INTO "TenantBillingPlan" ("organizationId",tier,status) VALUES ('org','growth','active')`);
    const f=fixture();await expect(f.service.checkout({organizationId:'org',userId:'owner'},input)).rejects.toThrow('existing_customer_unchanged');expect(f.calls()).toBe(0);
  });
  it("rejects applying the schema twice without changing existing data", async () => {
    await expect(db.exec(sql)).rejects.toThrow("public_billing_schema_already_or_partially_present");
    await db.exec("ROLLBACK");
    expect((await db.query('SELECT * FROM "OrgMembership"')).rows).toHaveLength(2);
  });
});

// Connected collection/credit tests use the same production service and SQL,
// with only Stripe transport and the isolated database boundary substituted.
