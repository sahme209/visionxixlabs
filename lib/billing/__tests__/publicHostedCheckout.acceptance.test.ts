import {describe,expect,it} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import Stripe from 'stripe';
import {createPublicCheckoutService} from '../publicCheckoutService';
import {createPublicSqlStore,type PublicSql} from '../publicBillingStore';
import {createPublicStripeProvider,type PublicStripeClient} from '../publicStripeProvider';
import {readPublicCreditAllowance} from '../publicCreditAuthority';
import {publicBillingTestSchema} from './fixtures/publicBillingDatabase';

type LocalDb={exec(sql:string):Promise<unknown>;query<T>(sql:string,values?:unknown[]):Promise<{rows:T[];affectedRows?:number}>;transaction<T>(fn:(tx:LocalDb)=>Promise<T>):Promise<T>;close():Promise<void>};
const enabled=process.env.AXIOM_HOSTED_CHECKOUT_ACCEPTANCE==='owned-temporary-sandbox-only';
/** Explicitly invoked, TEST money only. Stripe's claimable sandbox does not
 * grant GET /v1/account, so account identity is taken from the independently
 * provisioned CLI profile, represented as a fixture only at that read boundary.
 * All price/Checkout/subscription/invoice/PaymentIntent/charge calls are real.
 * Auth/session, webhook transport/signature and PostgreSQL use local fixtures;
 * this is not claimed as the installed app or live-account customer journey. */
describe.skipIf(!enabled)('hosted Stripe TEST Checkout and actual fulfillment',()=>{
 it('completes a hosted card checkout, grants exact credits once, and revokes a refund',async()=>{
  const scratch='/private/tmp/axiom-billing-acceptance',profile=readFileSync(scratch+'/config.toml','utf8');
  const field=(name:string)=>profile.match(new RegExp('^\\s*'+name+'\\s*=\\s*["\x27]([^"\x27]+)["\x27]','m'))?.[1];
  const key=field('test_mode_api_key'),accountId=field('account_id'),catalog=JSON.parse(readFileSync(scratch+'/catalog.json','utf8'));
  if(!key?.startsWith('rkcs_test_')||accountId!=='acct_1UTKmuPpAO27xXx0'||catalog.accountId!==accountId||catalog.livemode!==false)throw Error('owned_test_sandbox_required');
  const stripe=new Stripe(key,{apiVersion:'2024-06-20' as Stripe.LatestApiVersion,maxNetworkRetries:0,timeout:15000});
  const pg=await import(/* @vite-ignore */ pathToFileURL('/private/tmp/axiom-billing-schema-rehearsal/node_modules/@electric-sql/pglite/dist/index.js').href);
  const pw=await import(/* @vite-ignore */ pathToFileURL(scratch+'/node_modules/playwright-core/index.mjs').href);
  const db:LocalDb=new pg.PGlite();let browser:Awaited<ReturnType<typeof pw.chromium.launch>>|undefined;let sessionId:string|undefined;let stage='setup';
  const server=createServer((_req,res)=>{res.writeHead(200,{'content-type':'text/plain'});res.end('Axiom isolated TEST checkout return. No production account was changed.');});
  const adapter=(database:LocalDb):PublicSql=>({$queryRawUnsafe:async<T>(sql:string,...values:unknown[])=>(await database.query(sql,values)).rows as T,$executeRawUnsafe:async(sql,...values)=>(await database.query(sql,values)).affectedRows??0});
  try{
   await db.exec(publicBillingTestSchema);await db.exec(readFileSync(new URL('../../../ops/recovery/20261022_public_billing_v1.sql',import.meta.url),'utf8'));
   await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('owned_listener_missing');
   const client={accounts:{retrieve:async()=>({id:accountId,lastResponse:{apiVersion:'2024-06-20',statusCode:200,requestId:'fixture_from_verified_sandbox_provisioning'}})},prices:stripe.prices,checkout:stripe.checkout,subscriptions:stripe.subscriptions,invoices:stripe.invoices,paymentIntents:stripe.paymentIntents,charges:stripe.charges} as unknown as PublicStripeClient;
   const identity={accountId,livemode:false},provider=await createPublicStripeProvider(client,identity,catalog.prices,()=>new Date());
   const store=createPublicSqlStore({$transaction:fn=>db.transaction(tx=>fn(adapter(tx)))});
   const service=createPublicCheckoutService({store,provider,configuredPrices:catalog.prices,now:()=>new Date(),id:()=>randomUUID()});
   stage='original_checkout_create';
   const result=await service.checkout({organizationId:'org',userId:'owner'},{planId:'pro',interval:'monthly',email:'axiom-acceptance@example.com',successUrl:`http://127.0.0.1:${address.port}/success`,cancelUrl:`http://127.0.0.1:${address.port}/cancel`});
   expect(result.kind).toBe('checkout_ready');if(result.kind!=='checkout_ready')throw Error('checkout_not_ready');
   const rows=await db.query<{id:string;sessionId:string}>('SELECT id,"sessionId" FROM "PublicCheckoutIntent"');sessionId=rows.rows[0]?.sessionId;if(!sessionId)throw Error('no_original_session');const intentId=rows.rows[0].id;
   writeFileSync(scratch+'/hosted-session.json',JSON.stringify({sessionId,intentId,accountId,livemode:false,url:result.url}),{mode:0o600});
   stage='hosted_checkout_render';browser=await pw.chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
   const page=await browser.newPage();await page.goto(result.url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('#cardNumber').waitFor({timeout:30000});
   const text=await page.locator('body').innerText();expect(text).toMatch(/test|sandbox/i);
   stage='hosted_test_card';await page.locator('#cardNumber').fill('4242424242424242');await page.locator('#cardExpiry').fill('1235');await page.locator('#cardCvc').fill('123');
   const name=page.locator('#billingName');if(await name.count())await name.fill('Axiom Isolated Acceptance');
   const country=page.locator('#billingCountry');if(await country.count())await country.selectOption('US');
   const postal=page.locator('#billingPostalCode');if(await postal.count())await postal.fill('30303');
   const labels=await page.locator('input').evaluateAll((nodes:HTMLInputElement[])=>nodes.map(n=>({id:n.id,name:n.name,required:n.required,type:n.type})));writeFileSync(scratch+'/hosted-form-fields.json',JSON.stringify(labels),{mode:0o600});
   const pass=page.locator('#enableStripePass');if(await pass.count() && await pass.isChecked())await pass.uncheck();
   writeFileSync(scratch+'/hosted-buttons.json',JSON.stringify(await page.getByRole('button').allTextContents()),{mode:0o600});
   stage='submit_test_payment';await page.getByRole('button',{name:/^Subscribe$/i}).click();
   const until=Date.now()+45000;let completed=false;
   while(Date.now()<until){const session=await stripe.checkout.sessions.retrieve(sessionId);if(session.livemode!==false)throw Error('test_mode_changed');if(session.status==='complete'&&session.payment_status==='paid'){completed=true;break;}await new Promise(resolve=>setTimeout(resolve,1000));}
   if(!completed){writeFileSync(scratch+'/hosted-visible-failure.txt',await page.locator('body').evaluate((body:HTMLElement)=>{const copy=body.cloneNode(true) as HTMLElement;copy.querySelectorAll('select,script,style').forEach(n=>n.remove());return (copy.textContent??'').slice(-10000);}),{mode:0o600});throw Error('hosted_test_payment_not_completed');}
   stage='canonical_collection_fulfillment';
   const session=await stripe.checkout.sessions.retrieve(sessionId),subscriptionId=typeof session.subscription==='string'?session.subscription:session.subscription?.id;if(!subscriptionId)throw Error('subscription_missing');
   const subscription=await stripe.subscriptions.retrieve(subscriptionId);const invoiceId=typeof subscription.latest_invoice==='string'?subscription.latest_invoice:subscription.latest_invoice?.id;if(!invoiceId)throw Error('invoice_missing');
   const trigger={id:'evt_owned_'+randomUUID().replaceAll('-',''),type:'invoice.paid',objectId:invoiceId};
   expect(await service.reconcile(intentId,trigger)).toBe('applied');expect(await service.reconcile(intentId,trigger)).toBe('replay');
   expect(await readPublicCreditAllowance(adapter(db),'org',identity,new Date())).toMatchObject({available:true,baseCents:2000,poolCents:2000,usedCents:0,heldCents:0,includedRemainingCents:2000});
   stage='real_test_refund';const invoice=await stripe.invoices.retrieve(invoiceId) as unknown as {charge:string};if(typeof invoice.charge!=='string')throw Error('charge_missing');
   const refund=await stripe.refunds.create({charge:invoice.charge},{idempotencyKey:'axiom_acceptance_refund_'+sessionId});expect(refund.status).toBe('succeeded');
   expect(await service.reconcile(intentId,{id:'evt_owned_refund_'+randomUUID().replaceAll('-',''),type:'charge.refunded',objectId:invoice.charge})).toBe('applied');
   expect(await readPublicCreditAllowance(adapter(db),'org',identity,new Date())).toEqual({available:false});
   writeFileSync(scratch+'/hosted-acceptance-receipt.json',JSON.stringify({passed:true,accountId,livemode:false,sessionId,subscriptionId,invoiceId,testAmountCents:5800,paidSeats:2,grantedCreditsCents:2000,duplicateEventIgnored:true,refundRevokedAccess:true,boundaries:{stripePayment:'real_TEST',hostedCheckout:'real_TEST_Chrome',providerObjects:'real_TEST',database:'isolated_PostgreSQL_WASM',accountIdentity:'CLI_provisioning_fixture',webhookDelivery:'fixture_trigger_no_claim_of_live_delivery',applicationAuth:'fixture'}},null,2),{mode:0o600});
  }catch(error){writeFileSync(scratch+'/hosted-acceptance-failure.json',JSON.stringify({stage,errorType:error instanceof Error?error.name:'unknown',code:typeof(error as {code?:unknown})?.code==='string'?(error as {code:string}).code:null}),{mode:0o600});throw Error(`owned_hosted_acceptance_failed:${stage}`);}
  finally{try{if(sessionId){const s=await stripe.checkout.sessions.retrieve(sessionId);if(s.livemode!==false)throw Error('not_test');if(s.status==='open')await stripe.checkout.sessions.expire(sessionId);const sub=typeof s.subscription==='string'?s.subscription:s.subscription?.id;if(sub)await stripe.subscriptions.cancel(sub);}}catch{writeFileSync(scratch+'/cleanup-warning.txt','Inspect TEST-only session cleanup; no production credentials were used.',{mode:0o600});}await browser?.close();server.close();await db.close();}
 },150000);
});
