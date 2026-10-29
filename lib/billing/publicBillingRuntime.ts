import { readPublicInvoicePage, type InvoiceStatus, type InvoiceListClient } from "./invoicePage";
import { assertPublicPortalConfiguration } from "./publicPortalPolicy";
import "server-only";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { configuredPublicBillingIdentity, PUBLIC_STRIPE_API_VERSION } from "./publicBillingConfig";
import { createPublicSqlStore } from "./publicBillingStore";
import { createPublicCheckoutService } from "./publicCheckoutService";
import { createPublicStripeProvider, type PublicStripeClient } from "./publicStripeProvider";
import { stripePriceEnvKey } from "./publicPlanCatalog";
import { reconcilePublicWebhook, type PublicLookupKind } from "./publicWebhookDispatch";

/** Per-request composition. Never accepts account, key or mode from the browser.
 * Each outbound call is bounded and has no SDK retry; unknown writes stay held. */
export async function publicBillingRuntime() {
  const identity=configuredPublicBillingIdentity();
  const key=process.env.STRIPE_SECRET_KEY?.trim()??'';
  if(!(identity.livemode?/^(sk|rk)_live_/:/^(sk|rk)_test_/).test(key))throw Error('public_stripe_key_mode_mismatch');
  const stripe=new Stripe(key,{apiVersion:PUBLIC_STRIPE_API_VERSION as Stripe.LatestApiVersion,maxNetworkRetries:0,timeout:10000});
  const prices:Record<string,string>={};
  for(const plan of ['pro','enterprise'] as const)for(const interval of ['monthly','annual'] as const){
    const price=process.env[stripePriceEnvKey(plan,interval)]?.trim();if(price)prices[`${plan}:${interval}`]=price;
  }
  const provider=await createPublicStripeProvider(stripe as unknown as PublicStripeClient,identity,prices,()=>new Date());
  const store=createPublicSqlStore(prisma);
  const service=createPublicCheckoutService({store,provider,configuredPrices:prices,now:()=>new Date(),id:()=>randomUUID()});
  async function get(kind:PublicLookupKind,id:string):Promise<unknown>{
    const response=kind==='session'?await stripe.checkout.sessions.retrieve(id):kind==='subscription'?await stripe.subscriptions.retrieve(id):kind==='invoice'?await stripe.invoices.retrieve(id):kind==='charge'?await stripe.charges.retrieve(id):kind==='dispute'?await stripe.disputes.retrieve(id):await stripe.creditNotes.retrieve(id);
    const receipt=response.lastResponse;
    if((receipt.apiVersion??receipt.headers['stripe-version'])!==PUBLIC_STRIPE_API_VERSION||!receipt.requestId||receipt.statusCode<200||receipt.statusCode>=300||receipt.stripeAccount&&receipt.stripeAccount!==identity.accountId)throw Error('stripe_response_boundary_invalid');
    return response;
  }
  async function portal(customerId:string,returnUrl:string){
    const configurationId=process.env.AXIOM_STRIPE_PORTAL_CONFIGURATION_ID?.trim()??"";
    if(!configurationId)throw Error("public_portal_configuration_unavailable");
    const configuration=await stripe.billingPortal.configurations.retrieve(configurationId);
    assertPublicPortalConfiguration(configuration,configurationId,identity.livemode);
    const session=await stripe.billingPortal.sessions.create({customer:customerId,configuration:configurationId,return_url:returnUrl});
    const url=new URL(session.url);
    if(url.protocol!=="https:"||url.hostname!=="billing.stripe.com"||url.username||url.password)throw Error("public_portal_url_invalid");
    return {ok:true as const,url:session.url};
  }
  return {identity,service,portal,invoices:(customerId:string,filter:{status?:InvoiceStatus;after?:string})=>readPublicInvoicePage(stripe as unknown as InvoiceListClient,identity,customerId,filter),webhook:(event:unknown)=>reconcilePublicWebhook(event,identity,{get},service.reconcile)};
}
