import "server-only";
import { PUBLIC_BILLING_POLICY, configuredPublicWebhookApiVersion } from "./publicBillingConfig";
import type { PublicBillingIdentity, PublicBillingTrigger } from "./publicCheckoutService";
import { automaticTopUpPurpose, type AutomaticTopUpRefundCharge } from "./automaticAICreditTopUpRefund";
import type { recordAutomaticTopUpTestDispute } from "./automaticAICreditTopUpDispute";
import type { makeAutomaticTopUpTestPaymentNotification } from "./automaticAICreditTopUpDispatchService";
export type PublicLookupKind = "session" | "subscription" | "invoice" | "charge" | "dispute" | "credit_note";
export interface PublicWebhookLookup { get(kind: PublicLookupKind, id: string): Promise<unknown> }
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const id = (v: unknown): string | null => typeof v === "string" ? v : typeof object(v).id === "string" ? object(v).id as string : null;
const supported = new Set(["checkout.session.completed","checkout.session.async_payment_succeeded","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed","invoice.voided","invoice.marked_uncollectible","charge.refunded","charge.dispute.created","charge.dispute.funds_withdrawn","charge.dispute.funds_reinstated","charge.dispute.closed","credit_note.created","credit_note.updated","credit_note.voided"]);
type DisputeRecorder = (
  event: Parameters<typeof recordAutomaticTopUpTestDispute>[2],
  dispute: Parameters<typeof recordAutomaticTopUpTestDispute>[3],
  charge: AutomaticTopUpRefundCharge,
) => ReturnType<typeof recordAutomaticTopUpTestDispute>;
const topUpPaymentEvents = new Set([
  "payment_intent.payment_failed", "payment_intent.requires_action", "payment_intent.processing",
  "payment_intent.succeeded", "payment_intent.canceled",
]);
type TestTopUpHandlers = {
  recordDispute?: DisputeRecorder;
  reconcilePayment?: ReturnType<typeof makeAutomaticTopUpTestPaymentNotification>;
};
/** Called ONLY after the HTTP receiver verified the raw Stripe signature.
 * Canonical reads find the original intent; event metadata never grants access. */
export async function reconcilePublicWebhook(event: unknown, identity: PublicBillingIdentity, lookup: PublicWebhookLookup, reconcile: (intentId: string, trigger: PublicBillingTrigger) => Promise<string>, testTopUps?: TestTopUpHandlers): Promise<{handled:false}|{handled:true;outcome:string}> {
  const e=object(event),payload=object(object(e.data).object);
  if(typeof e.type!=='string')return {handled:false};
  const topUpPayment=topUpPaymentEvents.has(e.type)&&object(payload.metadata).purpose===automaticTopUpPurpose;
  if(!topUpPayment&&!supported.has(e.type))return {handled:false};
  if(typeof e.id!=='string'||!/^evt_[A-Za-z0-9_]{1,180}$/.test(e.id)||typeof payload.id!=='string'||e.livemode!==identity.livemode||e.api_version!==configuredPublicWebhookApiVersion()||e.account!=null&&e.account!==identity.accountId)throw Error('public_webhook_boundary_invalid');
  if(topUpPayment){
    const meta=object(payload.metadata);
    if(identity.livemode!==false||payload.object!=='payment_intent'||!testTopUps?.reconcilePayment
      ||typeof meta.organizationId!=='string'||!meta.organizationId||typeof meta.intentId!=='string'||!meta.intentId) {
      throw Error('automatic_top_up_payment_unverified');
    }
    const result=await testTopUps.reconcilePayment(
      {organizationId:meta.organizationId,intentId:meta.intentId},payload.id,e.type==="payment_intent.succeeded",
    );
    if(result.kind==='retry')throw Error('automatic_top_up_payment_unverified');
    return {handled:true,outcome:result.kind};
  }
  async function read(kind:PublicLookupKind,ref:string){const row=object(await lookup.get(kind,ref));if(row.id!==ref||row.livemode!==identity.livemode)throw Error('public_webhook_object_mismatch');return row;}
  let type=e.type,objectId=payload.id,sub:Record<string,unknown>;
  if(type.startsWith('checkout.session.')) {
    const session=await read('session',objectId),meta=object(session.metadata);
    if(meta.billingPolicy!==PUBLIC_BILLING_POLICY)return {handled:false};
    if(typeof meta.intentId!=='string'||!meta.intentId||typeof meta.organizationId!=='string'||!meta.organizationId)throw Error('public_webhook_intent_missing');
    return {handled:true,outcome:await reconcile(meta.intentId,{id:e.id,type,objectId})};
  }
  if(type.startsWith('customer.subscription.'))sub=await read('subscription',objectId);
  else {
    let invoice:Record<string,unknown>;
    let dispute:Record<string,unknown>|undefined;
    if(type.startsWith('charge.dispute.')){
      dispute=await read('dispute',objectId);const chargeId=id(dispute.charge);if(!chargeId)throw Error('public_webhook_charge_missing');objectId=chargeId;
    }
    if(type.startsWith('charge.')) {
      const charge=await read('charge',objectId);
      if(dispute && object(charge.metadata).purpose===automaticTopUpPurpose){
        if(identity.livemode!==false||!testTopUps?.recordDispute)throw Error('automatic_top_up_dispute_unavailable');
        const outcome=await testTopUps.recordDispute({id:e.id,type},dispute,charge);
        if(outcome==='payment_unbound'||outcome==='invalid')throw Error('automatic_top_up_dispute_unverified');
        return {handled:true,outcome};
      }
      const invoiceId=id(charge.invoice);if(!invoiceId)return {handled:false};invoice=await read('invoice',invoiceId);
      if(id(invoice.customer)!==id(charge.customer))throw Error('public_webhook_owner_mismatch');
    }else if(type.startsWith('credit_note.')){
      const note=await read('credit_note',objectId),invoiceId=id(note.invoice);if(!invoiceId)throw Error('public_webhook_invoice_missing');invoice=await read('invoice',invoiceId);
      if(id(note.customer)!==id(invoice.customer))throw Error('public_webhook_owner_mismatch');type='invoice.credit_note_changed';objectId=invoiceId;
    }else invoice=await read('invoice',objectId);
    const subscriptionId=id(invoice.subscription);if(!subscriptionId)return {handled:false};sub=await read('subscription',subscriptionId);
    if(id(sub.customer)!==id(invoice.customer))throw Error('public_webhook_owner_mismatch');
  }
  const meta=object(sub.metadata);
  if(meta.billingPolicy!==PUBLIC_BILLING_POLICY)return {handled:false};
  if(typeof meta.intentId!=='string'||!meta.intentId||typeof meta.organizationId!=='string'||!meta.organizationId)throw Error('public_webhook_intent_missing');
  return {handled:true,outcome:await reconcile(meta.intentId,{id:e.id,type,objectId})};
}
