import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
const m=vi.hoisted(()=>({context:vi.fn(),runtime:vi.fn(),checkout:vi.fn(),webhook:vi.fn(),legacy:vi.fn(),legacyReconcile:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:m.context}));
vi.mock('@/lib/auth/platformAdmin',()=>({isAdminOrOwner:()=>true}));
vi.mock('@/lib/billing/publicBillingRuntime',()=>({publicBillingRuntime:m.runtime}));
vi.mock('@/lib/billing/stripeHelper',async original=>({...await original<object>(),createCheckoutSession:m.legacy}));
vi.mock('@/lib/billing/reconcileSubscriptionEvent',()=>({reconcileSubscriptionEvent:m.legacyReconcile}));
vi.mock('@/lib/db',()=>({prisma:{tenantBillingPlan:{findUnique:async()=>null},orgMembership:{count:async()=>2}}}));
const origin='https://visionxixlabs.com';
function checkout(body:unknown){return new NextRequest(origin+'/api/billing/checkout-session',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});}
function webhook(valid=true){const body=JSON.stringify({id:'evt_fixture',type:'invoice.paid',api_version:'2024-06-20',livemode:false,data:{object:{id:'in_fixture'}}}),timestamp=Math.floor(Date.now()/1000),sig=createHmac('sha256','whsec_test_fixture').update(`${timestamp}.${body}`).digest('hex');return new NextRequest(origin+'/api/billing/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${valid?sig:'0'.repeat(64)}`},body});}
describe('public billing production HTTP boundaries',()=>{
  beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_SELF_SERVICE_BILLING_ENABLED','true');vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_test_fixture');vi.stubEnv('NEXTAUTH_URL',origin);vi.stubEnv('AXIOM_STRIPE_MODE','test');m.context.mockResolvedValue({isAuthenticated:true,organizationId:'org',userId:'owner',email:'owner@example.invalid',roles:['owner']});m.runtime.mockResolvedValue({service:{checkout:m.checkout},webhook:m.webhook});m.checkout.mockResolvedValue({kind:'checkout_ready',url:'https://checkout.stripe.com/c/pay/cs_fixture'});m.webhook.mockResolvedValue({handled:true,outcome:'applied'});});
  afterEach(()=>vi.unstubAllEnvs());
  it('uses durable checkout with the authenticated actor and ignores client seat claims',async()=>{const {POST}=await import('@/app/api/billing/checkout-session/route');const r=await POST(checkout({planId:'pro',billingInterval:'monthly',expectedOrganizationId:'org',seatCount:999}));expect(r.status).toBe(200);expect(m.checkout).toHaveBeenCalledWith({organizationId:'org',userId:'owner'},{planId:'pro',interval:'monthly',email:'owner@example.invalid',successUrl:origin+'/control/usage-billing?billing=success',cancelUrl:origin+'/plans?checkout=canceled'});expect(m.legacy).not.toHaveBeenCalled();expect(await r.json()).toMatchObject({data:{ok:true,url:'https://checkout.stripe.com/c/pay/cs_fixture'}});});
  it('does not dispatch a checkout for missing actor identity',async()=>{m.context.mockResolvedValue({isAuthenticated:true,organizationId:'org',email:'owner@example.invalid',roles:['owner']});const {POST}=await import('@/app/api/billing/checkout-session/route');expect((await POST(checkout({planId:'pro',expectedOrganizationId:'org'}))).status).toBe(401);expect(m.runtime).not.toHaveBeenCalled();});
  it('reports unknown purchase without exposing a URL or invoking legacy checkout',async()=>{m.checkout.mockResolvedValue({kind:'reconciliation_required'});const {POST}=await import('@/app/api/billing/checkout-session/route');const r=await POST(checkout({planId:'pro',expectedOrganizationId:'org'}));expect(r.status).toBe(409);expect(JSON.stringify(await r.json())).not.toContain('checkout.stripe.com');expect(m.legacy).not.toHaveBeenCalled();});
  it('rejects a bad raw webhook signature before provider or database work',async()=>{const {POST}=await import('@/app/api/billing/stripe-webhook/route');expect((await POST(webhook(false))).status).toBe(401);expect(m.runtime).not.toHaveBeenCalled();});
  it('fulfills signed invoices through current proof rather than ignoring invoice events',async()=>{const {POST}=await import('@/app/api/billing/stripe-webhook/route');const r=await POST(webhook());expect(r.status).toBe(200);expect(m.webhook).toHaveBeenCalledWith(expect.objectContaining({type:'invoice.paid'}));expect(m.legacyReconcile).not.toHaveBeenCalled();});
  it('keeps subscription reconciliation active when new checkout sales are paused',async()=>{vi.stubEnv('AXIOM_SELF_SERVICE_BILLING_ENABLED','false');const {POST}=await import('@/app/api/billing/stripe-webhook/route');expect((await POST(webhook())).status).toBe(200);expect(m.webhook).toHaveBeenCalledTimes(1);});
  it('returns retryable failure when canonical collection cannot be verified',async()=>{m.webhook.mockRejectedValue(Error('synthetic secret-like internal error'));const {POST}=await import('@/app/api/billing/stripe-webhook/route');const r=await POST(webhook());expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain('secret-like');});
});

it('keeps the legacy subscription webhook retired while public sales are paused',async()=>{
 vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');
 vi.stubEnv('AXIOM_SELF_SERVICE_BILLING_ENABLED','false');
 try{
  const {POST}=await import('@/app/api/webhooks/stripe/route');
  const result=await POST(webhook(false));
  expect(result.status).toBe(410);
  expect(await result.json()).toMatchObject({canonicalEndpoint:'/api/billing/stripe-webhook'});
 }finally{vi.unstubAllEnvs();}
});
