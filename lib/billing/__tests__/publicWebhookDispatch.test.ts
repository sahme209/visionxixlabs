import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { reconcilePublicWebhook, type PublicWebhookLookup } from "../publicWebhookDispatch";
const identity={accountId:'acct_fixture',livemode:false};
const subscription={id:'sub_fixture',customer:'cus_fixture',livemode:false,metadata:{billingPolicy:'axiom_public_anniversary_v1',intentId:'intent_1',organizationId:'org_1'}};
function fixture(){
  const seen:unknown[]=[];
  const lookup:PublicWebhookLookup={get:async(kind,id)=>{
    seen.push([kind,id]);
    if(kind==='subscription')return subscription;
    if(kind==='invoice')return {id,subscription:'sub_fixture',customer:'cus_fixture',livemode:false};
    if(kind==='charge')return {id,invoice:'in_fixture',customer:'cus_fixture',livemode:false};
    if(kind==='dispute')return {id,charge:'ch_fixture',livemode:false};
    if(kind==='credit_note')return {id,invoice:'in_fixture',customer:'cus_fixture',livemode:false};
    return {id,subscription:'sub_fixture',customer:'cus_fixture',livemode:false,metadata:subscription.metadata};
  }};
  const applied:unknown[]=[];
  return {lookup,seen,applied,reconcile:async(intent:string,event:unknown)=>{applied.push([intent,event]);return 'applied';}};
}
const event=(type:string,id='in_fixture')=>({id:'evt_fixture',type,api_version:'2024-06-20',livemode:false,data:{object:{id,metadata:subscription.metadata}}});
describe('verified public webhook dispatch',()=>{
  beforeEach(()=>{vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');});afterEach(()=>vi.unstubAllEnvs());
  it.each(['invoice.paid','invoice.payment_failed','invoice.voided'])('resolves %s from canonical invoice/subscription, not event metadata',async type=>{
    const f=fixture(),e=event(type);e.data.object.metadata={...subscription.metadata,intentId:'forged'};
    expect(await reconcilePublicWebhook(e,identity,f.lookup,f.reconcile)).toEqual({handled:true,outcome:'applied'});
    expect(f.applied).toEqual([['intent_1',{id:'evt_fixture',type,objectId:'in_fixture'}]]);
    expect(f.seen).toEqual([['invoice','in_fixture'],['subscription','sub_fixture']]);
  });
  it('canonicalizes a dispute to its charge before checking current collection',async()=>{
    const f=fixture();await reconcilePublicWebhook(event('charge.dispute.created','dp_fixture'),identity,f.lookup,f.reconcile);
    expect(f.applied).toEqual([['intent_1',{id:'evt_fixture',type:'charge.dispute.created',objectId:'ch_fixture'}]]);
  });
  it('routes only canonical automatic top-up disputes into prepaid accounting',async()=>{
    const f=fixture();
    const dispute={id:'du_fixture',livemode:false,charge:'ch_fixture'};
    const charge={id:'ch_fixture',livemode:false,metadata:{purpose:'axiom_auto_ai_credit_top_up_v1'}};
    f.lookup.get=vi.fn(async(kind)=>kind==='dispute'?dispute:charge);
    const record=vi.fn().mockResolvedValueOnce('recorded').mockResolvedValueOnce('payment_unbound');
    const notification=event('charge.dispute.created','du_fixture');
    await expect(reconcilePublicWebhook(notification,identity,f.lookup,f.reconcile,{recordDispute:record})).resolves.toEqual({handled:true,outcome:'recorded'});
    expect(record).toHaveBeenCalledExactlyOnceWith({id:'evt_fixture',type:'charge.dispute.created'},dispute,charge);
    expect(f.applied).toEqual([]);
    await expect(reconcilePublicWebhook(notification,identity,f.lookup,f.reconcile,{recordDispute:record})).rejects.toThrow('automatic_top_up_dispute_unverified');
  });
  it('uses signed automatic payment events only as scoped triggers for a canonical read',async()=>{
    const f=fixture();
    const reconcilePayment=vi.fn().mockResolvedValueOnce({kind:'provider_observed',status:'requires_payment_method'}).mockResolvedValueOnce({kind:'retry'});
    const notification={...event('payment_intent.payment_failed','pi_fixture'),data:{object:{
      id:'pi_fixture',object:'payment_intent',status:'succeeded',
      metadata:{purpose:'axiom_auto_ai_credit_top_up_v1',organizationId:'org_fixture',intentId:'intent_fixture'},
    }}};
    await expect(reconcilePublicWebhook({...notification,account:'acct_other'},identity,f.lookup,f.reconcile,{reconcilePayment})).rejects.toThrow('public_webhook_boundary_invalid');
    expect(reconcilePayment).not.toHaveBeenCalled();
    await expect(reconcilePublicWebhook(notification,identity,f.lookup,f.reconcile,{reconcilePayment})).resolves.toEqual({handled:true,outcome:'provider_observed'});
    expect(reconcilePayment).toHaveBeenCalledExactlyOnceWith({organizationId:'org_fixture',intentId:'intent_fixture'},'pi_fixture',false);
    await expect(reconcilePublicWebhook(notification,identity,f.lookup,f.reconcile,{reconcilePayment})).rejects.toThrow('automatic_top_up_payment_unverified');
    expect(f.applied).toEqual([]);
  });
  it('canonicalizes a credit note to its invoice and rechecks current collection',async()=>{
    const f=fixture();await reconcilePublicWebhook(event('credit_note.created','cn_fixture'),identity,f.lookup,f.reconcile);
    expect(f.applied).toEqual([['intent_1',{id:'evt_fixture',type:'invoice.credit_note_changed',objectId:'in_fixture'}]]);
  });
  it('does not touch unrelated VisaNova or legacy subscription resources',async()=>{
    const f=fixture();f.lookup.get=async(_kind,id)=>({id,livemode:false,customer:'cus_legacy',metadata:{planId:'visanova'}});
    expect(await reconcilePublicWebhook(event('customer.subscription.updated','sub_legacy'),identity,f.lookup,f.reconcile)).toEqual({handled:false});
    expect(f.applied).toHaveLength(0);
  });
  it.each([{livemode:true},{account:'acct_other'},{api_version:'2026-01-28.clover'}])('rejects foreign event boundaries %#',async change=>{
    const f=fixture();await expect(reconcilePublicWebhook({...event('invoice.paid'),...change},identity,f.lookup,f.reconcile)).rejects.toThrow();expect(f.applied).toHaveLength(0);
  });
  it('rejects a foreign canonical invoice identity',async()=>{
    const f=fixture();f.lookup.get=async()=>({id:'in_other',livemode:false,subscription:'sub_fixture'});
    await expect(reconcilePublicWebhook(event('invoice.paid'),identity,f.lookup,f.reconcile)).rejects.toThrow();expect(f.applied).toHaveLength(0);
  });
  it('accepts an explicitly configured Clover notification but resolves authority through canonical reads',async()=>{
    vi.stubEnv('AXIOM_STRIPE_WEBHOOK_API_VERSION','2025-12-15.clover');
    const f=fixture(); const notification={...event('invoice.paid'),api_version:'2025-12-15.clover',data:{object:{id:'in_fixture',metadata:{intentId:'forged',organizationId:'foreign'},status:'paid'}}};
    await expect(reconcilePublicWebhook(notification,identity,f.lookup,f.reconcile)).resolves.toEqual({handled:true,outcome:'applied'});
    expect(f.seen).toEqual([['invoice','in_fixture'],['subscription','sub_fixture']]);
    expect(f.applied).toEqual([['intent_1',{id:'evt_fixture',type:'invoice.paid',objectId:'in_fixture'}]]);
  });
  it('does not accept Clover notifications by default',async()=>{
    const f=fixture();await expect(reconcilePublicWebhook({...event('invoice.paid'),api_version:'2025-12-15.clover'},identity,f.lookup,f.reconcile)).rejects.toThrow('public_webhook_boundary_invalid');expect(f.seen).toEqual([]);
  });
  it.each(['','latest','2026-01-28.clover'])('rejects unreviewed webhook version configuration before provider reads: %s',async version=>{
    vi.stubEnv('AXIOM_STRIPE_WEBHOOK_API_VERSION',version);const f=fixture();await expect(reconcilePublicWebhook(event('invoice.paid'),identity,f.lookup,f.reconcile)).rejects.toThrow('public_webhook_version_unavailable');expect(f.seen).toEqual([]);
  });
  it('requires the delivered version to match the configured webhook version',async()=>{
    vi.stubEnv('AXIOM_STRIPE_WEBHOOK_API_VERSION','2025-12-15.clover');const f=fixture();await expect(reconcilePublicWebhook(event('invoice.paid'),identity,f.lookup,f.reconcile)).rejects.toThrow('public_webhook_boundary_invalid');expect(f.seen).toEqual([]);
  });

});
