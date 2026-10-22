import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { NextRequest } from 'next/server';
import { createPublicSqlStore, type PublicSql } from '../publicBillingStore';
import { createPublicCheckoutService } from '../publicCheckoutService';
import { createPublicStripeProvider, type PublicStripeClient } from '../publicStripeProvider';
import { reconcilePublicWebhook, type PublicLookupKind } from '../publicWebhookDispatch';
import { readPublicCreditAllowance } from '../publicCreditAuthority';
import { readBillingPlanWithAvailability } from '../tenantBillingStore';
import { publicPaymentFixture } from './fixtures/publicPayment';
import { publicBillingTestSchema } from './fixtures/publicBillingDatabase';

// Only authentication and external SDK transport are fixtures. The actual HTTP
// handlers, HMAC verifier, provider-object validation, service, SQL store,
// immutable evidence and account/credit readers are connected below.
const state = vi.hoisted(() => ({ runtime: null as unknown, userId: 'owner' }));
vi.mock('@/lib/auth/currentContext', () => ({ currentContext: async () => ({ isAuthenticated: true, userId: state.userId, organizationId: 'org', email: 'owner@example.invalid', roles: ['owner'] }) }));
vi.mock('@/lib/auth/platformAdmin', () => ({ isAdminOrOwner: () => true }));
vi.mock('@/lib/billing/publicBillingRuntime', () => ({ publicBillingRuntime: async () => state.runtime }));

type Pg = { exec(sql: string): Promise<unknown>; query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>; transaction<T>(fn: (p: Pg) => Promise<T>): Promise<T>; close(): Promise<void> };
const modulePath = process.env.AXIOM_PGLITE_TEST_MODULE;
const origin = 'https://visionxixlabs.com';
const identity = { accountId: 'acct_fixture', livemode: false };
const sql = readFileSync(new URL('../../../ops/recovery/20261022_public_billing_v1.sql', import.meta.url), 'utf8');
const adapter = (db: Pg): PublicSql => ({ $queryRawUnsafe: async <T>(q: string, ...args: unknown[]) => (await db.query(q, args)).rows as T, $executeRawUnsafe: async (q, ...args) => (await db.query(q, args)).affectedRows ?? 0 });
const receipt = (value: unknown) => ({ ...(value as object), lastResponse: { requestId: 'req_fixture', statusCode: 200, apiVersion: '2024-06-20', headers: { 'stripe-version': '2024-06-20' } } });
function signed(type: string, objectId: string, eventId: string, valid = true) {
  const raw = JSON.stringify({ id: eventId, type, api_version: '2024-06-20', livemode: false, data: { object: { id: objectId } } });
  const at = Math.floor(Date.now()/1000), sig = createHmac('sha256', 'whsec_connected_fixture').update(`${at}.${raw}`).digest('hex');
  return new NextRequest(origin+'/api/billing/stripe-webhook', { method: 'POST', body: raw, headers: { 'stripe-signature': `t=${at},v1=${valid ? sig : '0'.repeat(64)}` } });
}
describe.skipIf(!modulePath)('connected payment-to-access HTTP and PostgreSQL journey', () => {
  let db: Pg, payment: ReturnType<typeof publicPaymentFixture>, session: Record<string, unknown>;
  let checkout: typeof import('@/app/api/billing/checkout-session/route').POST, webhook: typeof import('@/app/api/billing/stripe-webhook/route').POST;
  beforeEach(async () => {
    for (const [key,value] of Object.entries({ AXIOM_PUBLIC_BILLING_POLICY:'axiom_public_anniversary_v1', AXIOM_STRIPE_ACCOUNT_ID:'acct_fixture', AXIOM_STRIPE_MODE:'test', AXIOM_SELF_SERVICE_BILLING_ENABLED:'true', STRIPE_WEBHOOK_SECRET:'whsec_connected_fixture', NEXTAUTH_URL:origin })) vi.stubEnv(key,value);
    state.userId='owner';
    const databaseModule=await import(/* @vite-ignore */ pathToFileURL(modulePath!).href); db=new databaseModule.PGlite() as Pg;
    await db.exec(publicBillingTestSchema); await db.exec(sql);
    payment=publicPaymentFixture(); session={};
    const sdk: PublicStripeClient = {
      accounts: { retrieve: async () => receipt({ id: identity.accountId }) },
      prices: { retrieve: async () => receipt({ ...payment.subscription.items.data[0].price, active: true, product: { id:'prod_pro', active:true, livemode:false } }) },
      checkout: { sessions: { retrieve: async () => receipt(session), create: async params => {
        const metadata=params.metadata as Record<string,string>, count=(params.line_items as Array<{quantity:number}>)[0].quantity;
        session={ id:'cs_fixture', mode:'subscription', livemode:false, status:'open', payment_status:'unpaid', subscription:null, invoice:null, client_reference_id:'org', metadata, url:'https://checkout.stripe.com/c/pay/cs_fixture', expires_at:Math.floor(Date.now()/1000)+3600 };
        payment.subscription.metadata={...payment.subscription.metadata,...metadata};
        payment.subscription.items.data[0].quantity=count; payment.invoice.lines.data[0].quantity=count;
        const total=2900*count; Object.assign(payment.invoice,{amount_paid:total,amount_due:total,subtotal:total,total}); payment.invoice.lines.data[0].amount=total;
        Object.assign(payment.payment,{amount:total,amount_received:total}); Object.assign(payment.charge,{amount:total,amount_captured:total});
        return receipt(session);
      } } },
      subscriptions:{retrieve:async()=>receipt(payment.subscription)}, invoices:{retrieve:async()=>receipt(payment.invoice)}, paymentIntents:{retrieve:async()=>receipt(payment.payment)}, charges:{retrieve:async()=>receipt(payment.charge)},
    };
    const provider=await createPublicStripeProvider(sdk,identity,{'pro:monthly':'price_pro'},()=>payment.now);
    const service=createPublicCheckoutService({store:createPublicSqlStore({$transaction:fn=>db.transaction(p=>fn(adapter(p)))}),provider,configuredPrices:{'pro:monthly':'price_pro'},now:()=>payment.now,id:()=> 'connected_intent'});
    const get=async(kind:PublicLookupKind)=>kind==='session'?session:kind==='subscription'?payment.subscription:kind==='invoice'?payment.invoice:payment.charge;
    state.runtime={service,webhook:(event:unknown)=>reconcilePublicWebhook(event,identity,{get},service.reconcile)};
    checkout=(await import('@/app/api/billing/checkout-session/route')).POST;
    webhook=(await import('@/app/api/billing/stripe-webhook/route')).POST;
  });
  afterEach(async()=>{await db?.close(); vi.unstubAllEnvs(); state.runtime=null;});
  async function begin(){const result=await checkout(new NextRequest(origin+'/api/billing/checkout-session',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({planId:'pro',billingInterval:'monthly',expectedOrganizationId:'org',seatCount:999})}));expect(result.status).toBe(200);expect(await result.json()).toMatchObject({data:{ok:true,url:'https://checkout.stripe.com/c/pay/cs_fixture'}});}
  function collect(){Object.assign(session,{status:'complete',payment_status:'paid',customer:'cus_fixture',subscription:'sub_fixture',invoice:'in_fixture'});}
  it('grants exactly $20 for two $29 seats only after a signed collected invoice and ignores duplicate delivery',async()=>{
    await begin(); expect(await readPublicCreditAllowance(adapter(db),'org',identity,payment.now)).toMatchObject({baseCents:200});
    collect(); expect((await webhook(signed('invoice.paid','in_fixture','evt_connected_paid'))).status).toBe(200);
    const repo={$transaction:<T>(fn:(p:PublicSql)=>Promise<T>)=>db.transaction(p=>fn(adapter(p)))};
    expect(await readBillingPlanWithAvailability('org',repo as never)).toMatchObject({available:true,plan:{publicPlanId:'pro',status:'active',seatQuantity:2,pricingPlan:{entitlements:{includedAICreditsCents:2000,maxUsers:2}}}});
    expect(await readPublicCreditAllowance(adapter(db),'org',identity,payment.now)).toMatchObject({available:true,baseCents:2000,includedRemainingCents:2000});
    expect((await webhook(signed('invoice.paid','in_fixture','evt_connected_paid'))).status).toBe(200);
    expect((await db.query('SELECT * FROM "PublicBillingEvent"')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM "PublicInvoiceCollection"')).rows).toHaveLength(1);
  });
  it('rejects invalid signatures and does not fulfill an unpaid active subscription',async()=>{
    await begin(); collect();
    expect((await webhook(signed('invoice.paid','in_fixture','evt_invalid',false))).status).toBe(401);
    payment.invoice.paid=false;
    expect((await webhook(signed('invoice.paid','in_fixture','evt_not_collected'))).status).toBe(200);
    expect((await db.query('SELECT * FROM "PublicSubscriptionContract"')).rows).toHaveLength(0);
    expect(await readPublicCreditAllowance(adapter(db),'org',identity,payment.now)).toMatchObject({baseCents:200});
  });
  it('revokes paid funding on refunds even with checkout disabled and never revives access from an older event',async()=>{
    await begin();collect();await webhook(signed('invoice.paid','in_fixture','evt_first'));
    vi.stubEnv('AXIOM_SELF_SERVICE_BILLING_ENABLED','false'); payment.charge.amount_refunded=100;
    expect((await webhook(signed('charge.refunded','ch_fixture','evt_refunded'))).status).toBe(200);
    expect(await readPublicCreditAllowance(adapter(db),'org',identity,payment.now)).toEqual({available:false});
    expect((await webhook(signed('customer.subscription.updated','sub_fixture','evt_old'))).status).toBe(200);
    expect(await readPublicCreditAllowance(adapter(db),'org',identity,payment.now)).toEqual({available:false});
  });
});
