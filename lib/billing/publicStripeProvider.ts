import "server-only";
import { createHash } from "node:crypto";
import { PUBLIC_STRIPE_API_VERSION } from "./publicBillingConfig";
import { observePublicSubscription, observeOriginalPublicCollection, type PublicSubscriptionBinding } from "./publicSubscriptionEvidence";
import type { PublicBillingIdentity, PublicCheckoutProvider } from "./publicCheckoutService";

type Retrieve = (id: string, options?: Record<string, unknown>) => Promise<unknown>;
export interface PublicStripeClient {
  accounts: { retrieve(): Promise<unknown> };
  prices: { retrieve: Retrieve };
  checkout: { sessions: { retrieve: Retrieve; create(params: Record<string, unknown>, options: { idempotencyKey: string }): Promise<unknown> } };
  subscriptions: { retrieve: Retrieve }; invoices: { retrieve: Retrieve };
  paymentIntents: { retrieve: Retrieve }; charges: { retrieve: Retrieve };
}
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const id=(v:unknown):string|null=>typeof v==='string'?v:typeof object(v).id==='string'?object(v).id as string:null;
function response(value:unknown,account:string):Record<string,unknown>{
  const v=object(value),r=object(v.lastResponse),headers=object(r.headers);
  const version=r.apiVersion??headers['stripe-version'];
  if(version!==PUBLIC_STRIPE_API_VERSION||typeof r.requestId!=='string'||!r.requestId||typeof r.statusCode!=='number'||r.statusCode<200||r.statusCode>=300||r.stripeAccount!=null&&r.stripeAccount!==account)throw Error('stripe_response_boundary_invalid');
  return v;
}
/** The caller constructs one SDK client with a verified mode/key, 2024-06-20,
 * finite request timeout and maxNetworkRetries:0. No production/test fallback. */
export async function createPublicStripeProvider(client:PublicStripeClient,expected:PublicBillingIdentity,prices:Record<string,string>,now:()=>Date):Promise<PublicCheckoutProvider>{
  const account=response(await client.accounts.retrieve(),expected.accountId);
  if(account.id!==expected.accountId)throw Error('stripe_account_mismatch');
  const identity=Object.freeze({...expected});
  const read=async(fn:Retrieve,value:string,options?:Record<string,unknown>)=>response(await fn(value,options),identity.accountId);
  return {
    identity:()=>identity,
    price:async(plan,interval)=>{const key=prices[`${plan}:${interval}`];if(!key)throw Error('public_price_not_configured');return read(client.prices.retrieve.bind(client.prices),key,{expand:['product']});},
    create:async(request,key)=>{
      if(createHash('sha256').update(request.json).digest('hex')!==request.digest)throw Error('checkout_request_changed');
      const params=JSON.parse(request.json) as Record<string,unknown>,meta=object(params.metadata);
      if(params.mode!=='subscription'||meta.billingPolicy!=='axiom_public_anniversary_v1')throw Error('checkout_request_invalid');
      const result=response(await client.checkout.sessions.create(params,{idempotencyKey:key}),identity.accountId),receipt=object(result.lastResponse);
      if(result.livemode!==identity.livemode||result.mode!=='subscription'||result.client_reference_id!==params.client_reference_id||object(result.metadata).intentId!==meta.intentId||object(result.metadata).organizationId!==meta.organizationId||object(result.metadata).billingPolicy!==meta.billingPolicy
        ||typeof result.id!=='string'||typeof result.url!=='string'||!Number.isSafeInteger(result.expires_at)||result.status!=='open'||result.payment_status!=='unpaid'||result.subscription!=null)throw Error('stripe_checkout_binding_mismatch');
      return {sessionId:result.id,url:result.url,accountId:identity.accountId,livemode:identity.livemode,requestId:receipt.requestId as string,statusCode:receipt.statusCode as number,providerKey:key,requestDigest:request.digest,expiresAt:new Date((result.expires_at as number)*1000).toISOString()};
    },
    session:sessionId=>read(client.checkout.sessions.retrieve.bind(client.checkout.sessions),sessionId),
    observe:async(intent,trigger)=>{
      if(!intent.sessionId||!intent.originalCreateProofDigest||intent.accountId!==identity.accountId||intent.livemode!==identity.livemode)throw Error('checkout_provenance_unavailable');
      const session=await read(client.checkout.sessions.retrieve.bind(client.checkout.sessions),intent.sessionId),meta=object(session.metadata);
      const customerId=id(session.customer),subscriptionId=id(session.subscription);
      if(session.id!==intent.sessionId||session.mode!=='subscription'||session.livemode!==identity.livemode||session.status!=='complete'||session.payment_status!=='paid'
        ||session.client_reference_id!==intent.organizationId||meta.organizationId!==intent.organizationId||meta.intentId!==intent.id||meta.enrollmentId!==intent.enrollmentId||meta.billingPolicy!==intent.policy
        ||meta.planId!==intent.planId||meta.billingInterval!==intent.interval||!customerId||!subscriptionId)throw Error('stripe_checkout_binding_mismatch');
      const subscription=await read(client.subscriptions.retrieve.bind(client.subscriptions),subscriptionId);
      if(subscription.id!==subscriptionId||subscription.livemode!==identity.livemode||id(subscription.customer)!==customerId)throw Error('stripe_subscription_binding_mismatch');
      if(trigger.type.startsWith('checkout.session.')){if(trigger.objectId!==session.id)throw Error('stripe_trigger_binding_mismatch');}
      else if(trigger.type.startsWith('customer.subscription.')){if(trigger.objectId!==subscriptionId)throw Error('stripe_trigger_binding_mismatch');}
      else if(trigger.type.startsWith('invoice.')){
        const invoice=await read(client.invoices.retrieve.bind(client.invoices),trigger.objectId);
        if(invoice.id!==trigger.objectId||id(invoice.subscription)!==subscriptionId||id(invoice.customer)!==customerId||invoice.livemode!==identity.livemode)throw Error('stripe_trigger_binding_mismatch');
      }else if(trigger.type==='charge.refunded'||trigger.type.startsWith('charge.dispute.')){
        const charge=await read(client.charges.retrieve.bind(client.charges),trigger.objectId),invoiceId=id(charge.invoice);
        if(charge.id!==trigger.objectId||id(charge.customer)!==customerId||charge.livemode!==identity.livemode||!invoiceId)throw Error('stripe_trigger_binding_mismatch');
        const invoice=await read(client.invoices.retrieve.bind(client.invoices),invoiceId);
        if(id(invoice.subscription)!==subscriptionId||id(invoice.customer)!==customerId||invoice.livemode!==identity.livemode)throw Error('stripe_trigger_binding_mismatch');
      }else throw Error('public_billing_trigger_unsupported');
      const binding:PublicSubscriptionBinding={policy:intent.policy,enrollmentId:intent.enrollmentId,organizationId:intent.organizationId,accountId:identity.accountId,livemode:identity.livemode,intentId:intent.id,
        contractId:'pc_'+createHash('sha256').update(`${identity.accountId}:${identity.livemode}:${intent.id}:${subscriptionId}`).digest('hex'),sessionId:intent.sessionId,customerId,subscriptionId,
        planId:intent.planId,interval:intent.interval,paidSeats:intent.paidSeats,priceId:intent.priceId,productId:intent.productId,unitAmountCents:intent.unitAmountCents,originalCreateProofDigest:intent.originalCreateProofDigest};
      let invoice:Record<string,unknown>={},payment:Record<string,unknown>={},charge:Record<string,unknown>={};
      const invoiceId=id(subscription.latest_invoice);
      if(invoiceId){invoice=await read(client.invoices.retrieve.bind(client.invoices),invoiceId);
        const paymentId=id(invoice.payment_intent),chargeId=id(invoice.charge);
        if(paymentId)payment=await read(client.paymentIntents.retrieve.bind(client.paymentIntents),paymentId);
        if(chargeId)charge=await read(client.charges.retrieve.bind(client.charges),chargeId);
      }
      const observation=observePublicSubscription(binding,{subscription,invoice,payment,charge},now());
      let initialCollection=null;
      if(observation.kind==="collected"){
        const originalId=id(session.invoice);
        if(!originalId)throw Error("stripe_original_invoice_missing");
        const firstInvoice=originalId===invoice.id?invoice:await read(client.invoices.retrieve.bind(client.invoices),originalId);
        const firstPaymentId=id(firstInvoice.payment_intent),firstChargeId=id(firstInvoice.charge);
        if(!firstPaymentId||!firstChargeId)throw Error("stripe_original_payment_missing");
        const firstPayment=firstPaymentId===payment.id?payment:await read(client.paymentIntents.retrieve.bind(client.paymentIntents),firstPaymentId);
        const firstCharge=firstChargeId===charge.id?charge:await read(client.charges.retrieve.bind(client.charges),firstChargeId);
        const items=object(subscription.items).data;
        initialCollection=observeOriginalPublicCollection(binding,{subscription,invoice:firstInvoice,payment:firstPayment,charge:firstCharge},subscription.billing_cycle_anchor,String(object(Array.isArray(items)?items[0]:null).id),originalId,now());
      }
      return {binding,observation,initialCollection};
    },
  };
}
