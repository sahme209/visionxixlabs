import 'server-only';
import { PUBLIC_STRIPE_API_VERSION } from './publicBillingConfig';
import type { PublicBillingIdentity } from './publicCheckoutService';
export type InvoiceStatus='draft'|'open'|'paid'|'uncollectible'|'void';
export interface InvoiceView {id:string;number:string;status:InvoiceStatus;currency:string;totalMinor:number;paidMinor:number;dueMinor:number;createdAt:string;hostedUrl:string|null;pdfUrl:string|null}
export interface InvoicePage {invoices:InvoiceView[];hasMore:boolean;nextCursor:string|null}
export interface InvoiceListClient {invoices:{list(params:Record<string,unknown>):Promise<unknown>}}
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const states:readonly string[]=['draft','open','paid','uncollectible','void'];
function link(value:unknown,hosts:readonly string[]):string|null{
 if(typeof value!=='string')return null;
 try{const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname)?url.toString():null;}catch{return null;}
}
/** Uses the account-verified, version-pinned runtime. No customer, account or
 * key is accepted from the browser. This reader creates no payment objects.
 * API: https://docs.stripe.com/api/invoices/list */
export async function readPublicInvoicePage(client:InvoiceListClient,identity:PublicBillingIdentity,customerId:string,filter:{status?:InvoiceStatus;after?:string}):Promise<InvoicePage>{
 if(!/^cus_[A-Za-z0-9_]+$/.test(customerId) || filter.status && !states.includes(filter.status) || filter.after && !/^in_[A-Za-z0-9_]{1,128}$/.test(filter.after))throw Error('invoice_selection_invalid');
 const value=object(await client.invoices.list({customer:customerId,limit:25,...(filter.status?{status:filter.status}:{}),...(filter.after?{starting_after:filter.after}:{})}));
 const receipt=object(value.lastResponse);const headers=object(receipt.headers);
 if((receipt.apiVersion??headers['stripe-version'])!==PUBLIC_STRIPE_API_VERSION || typeof receipt.requestId!=='string' || !receipt.requestId || typeof receipt.statusCode!=='number' || receipt.statusCode<200 || receipt.statusCode>=300 || receipt.stripeAccount!=null && receipt.stripeAccount!==identity.accountId)throw Error('invoice_response_unverified');
 if(!Array.isArray(value.data) || value.data.length>25 || typeof value.has_more!=='boolean' || value.has_more && value.data.length===0)throw Error('invoice_page_invalid');
 const seen=new Set<string>();
 const invoices=value.data.map((raw:unknown):InvoiceView=>{
  const row=object(raw);const customer=typeof row.customer==='string'?row.customer:object(row.customer).id;
  if(typeof row.id!=='string' || !/^in_[A-Za-z0-9_]+$/.test(row.id) || seen.has(row.id) || customer!==customerId || row.livemode!==identity.livemode || typeof row.currency!=='string' || !/^[a-z]{3}$/.test(row.currency) || !Number.isSafeInteger(row.total) || !Number.isSafeInteger(row.amount_paid) || (row.amount_paid as number)<0 || !Number.isSafeInteger(row.amount_due) || (row.amount_due as number)<0 || typeof row.created!=='number' || !Number.isSafeInteger(row.created) || row.created<0 || !Number.isFinite(new Date(row.created*1000).getTime()) || typeof row.status!=='string' || !states.includes(row.status))throw Error('invoice_binding_invalid');
  seen.add(row.id);
  return {id:row.id,number:typeof row.number==='string'&&row.number.trim()?row.number:row.id,status:row.status as InvoiceStatus,currency:row.currency,totalMinor:row.total as number,paidMinor:row.amount_paid as number,dueMinor:row.amount_due as number,createdAt:new Date(row.created*1000).toISOString(),hostedUrl:link(row.hosted_invoice_url,['invoice.stripe.com']),pdfUrl:link(row.invoice_pdf,['pay.stripe.com','invoice.stripe.com'])};
 });
 return {invoices,hasMore:value.has_more,nextCursor:value.has_more?invoices[invoices.length-1].id:null};
}
