import { describe, expect, it } from "vitest";
import { createPublicStripeProvider, type PublicStripeClient } from "../publicStripeProvider";
import { publicPaymentFixture } from "./fixtures/publicPayment";
import type { PublicCheckoutIntent } from "../publicCheckoutService";

function fixture(){
  const f=publicPaymentFixture();
  const response=<T extends object>(body:T)=>({...body,lastResponse:{apiVersion:'2024-06-20',statusCode:200,requestId:'req_fixture'}});
  const metadata={billingPolicy:f.binding.policy,enrollmentId:f.binding.enrollmentId,intentId:f.binding.intentId,organizationId:f.binding.organizationId,planId:f.binding.planId,billingInterval:f.binding.interval};
  const session={id:f.binding.sessionId,invoice:f.invoice.id,livemode:false,mode:'subscription',status:'complete',payment_status:'paid',customer:f.binding.customerId,subscription:f.binding.subscriptionId,client_reference_id:f.binding.organizationId,metadata};
  const createCalls:unknown[]=[];
  const client:PublicStripeClient={
    accounts:{retrieve:async()=>response({id:f.binding.accountId})},
    prices:{retrieve:async()=>response({...f.subscription.items.data[0].price,active:true,product:{id:f.binding.productId,active:true,livemode:false}})},
    checkout:{sessions:{create:async(params,options)=>{createCalls.push({params,options});return response({...session,status:'open',payment_status:'unpaid',subscription:null,customer:null,url:'https://checkout.stripe.com/c/pay/'+session.id,expires_at:Date.parse('2026-10-23T10:00:00Z')/1000});},retrieve:async()=>response(session)}},
    subscriptions:{retrieve:async()=>response(f.subscription)},invoices:{retrieve:async()=>response(f.invoice)},paymentIntents:{retrieve:async()=>response(f.payment)},charges:{retrieve:async()=>response(f.charge)},
  };
  const intent:PublicCheckoutIntent={policy:f.binding.policy,id:f.binding.intentId,enrollmentId:f.binding.enrollmentId,organizationId:f.binding.organizationId,actorUserId:'owner',accountId:f.binding.accountId,livemode:false,planId:'pro',interval:'monthly',email:'owner@example.invalid',successUrl:'https://app.example.invalid/ok',cancelUrl:'https://app.example.invalid/cancel',paidSeats:3,priceId:f.binding.priceId,productId:f.binding.productId,unitAmountCents:2900,requestJson:'{}',requestDigest:'a'.repeat(64),providerKey:'axiom_public_intent_1',state:'confirmed',sessionId:session.id,sessionUrl:'https://checkout.stripe.com/c/pay/'+session.id,originalCreateProofDigest:'a'.repeat(64),createdAt:'2026-10-22T09:00:00Z',expiresAt:null,revision:2};
  return {f,client,session,intent,createCalls,response};
}

describe('public Stripe canonical provider',()=>{
  it('retrieves the original session and current collected subscription through the pinned account',async()=>{
    const x=fixture();const p=await createPublicStripeProvider(x.client,{accountId:x.f.binding.accountId,livemode:false},{'pro:monthly':x.f.binding.priceId},()=>x.f.now);
    const r=await p.observe!(x.intent,{id:'evt_paid',type:'invoice.paid',objectId:x.f.invoice.id});
    expect(r.observation).toMatchObject({kind:'collected',coverage:{amountCents:8700,paidSeats:3}});expect(r.binding.originalCreateProofDigest).toBe(x.intent.originalCreateProofDigest);
  });
  it('rejects the wrong authenticated account before creating a session',async()=>{
    const x=fixture();await expect(createPublicStripeProvider(x.client,{accountId:'acct_other',livemode:false},{},()=>x.f.now)).rejects.toThrow('stripe_account_mismatch');expect(x.createCalls).toHaveLength(0);
  });
  it('requires the original Checkout session metadata, not just arbitrary subscription metadata',async()=>{
    const x=fixture();x.session.metadata.intentId='intent_other';const p=await createPublicStripeProvider(x.client,{accountId:x.f.binding.accountId,livemode:false},{},()=>x.f.now);
    await expect(p.observe!(x.intent,{id:'evt_paid',type:'invoice.paid',objectId:x.f.invoice.id})).rejects.toThrow('stripe_checkout_binding_mismatch');
  });
  it('refuses a subscription object read with an incompatible API version',async()=>{
    const x=fixture();x.client.subscriptions.retrieve=async()=>({...x.f.subscription,lastResponse:{apiVersion:'2025-03-31.basil',statusCode:200,requestId:'req_other'}});
    const p=await createPublicStripeProvider(x.client,{accountId:x.f.binding.accountId,livemode:false},{},()=>x.f.now);
    await expect(p.observe!(x.intent,{id:'evt_paid',type:'invoice.paid',objectId:x.f.invoice.id})).rejects.toThrow('stripe_response_boundary_invalid');
  });
  it('cannot reconcile an unrelated charge trigger into this organization',async()=>{
    const x=fixture();x.client.charges.retrieve=async()=>x.response({...x.f.charge,invoice:'in_foreign'});
    const p=await createPublicStripeProvider(x.client,{accountId:x.f.binding.accountId,livemode:false},{},()=>x.f.now);
    await expect(p.observe!(x.intent,{id:'evt_refund',type:'charge.refunded',objectId:'ch_foreign'})).rejects.toThrow();
  });
});
