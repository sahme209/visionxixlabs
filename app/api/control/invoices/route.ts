import {NextResponse,type NextRequest} from 'next/server';
import {currentContext} from '@/lib/auth/currentContext';
import {readBillingPlanWithAvailability} from '@/lib/billing/tenantBillingStore';
import {publicBillingRuntime} from '@/lib/billing/publicBillingRuntime';
import type {InvoiceStatus} from '@/lib/billing/invoicePage';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:NextRequest){
 try{
  const context=await currentContext();
  if(!context.isAuthenticated || !context.userId || !context.organizationId)return reply({ok:false,error:'sign_in_required'},401);
  if(!context.roles.some(role=>role==='owner'||role==='admin'))return reply({ok:false,error:'workspace_admin_required'},403);
  const status=request.nextUrl.searchParams.get('status');const after=request.nextUrl.searchParams.get('after');
  if(status!==null && !['draft','open','paid','uncollectible','void'].includes(status) || after!==null && !/^in_[A-Za-z0-9_]{1,128}$/.test(after))return reply({ok:false,error:'invoice_filter_invalid'},400);
  const billing=await readBillingPlanWithAvailability(String(context.organizationId));
  if(!billing.available)return reply({ok:false,error:'billing_unavailable'},503);
  if(!billing.plan.stripeCustomerId)return reply({ok:true,data:{state:'no_customer',invoices:[],hasMore:false,nextCursor:null}});
  // Legacy billing keeps its existing secure portal rather than borrowing a
  // public-account credential or guessing a mode/customer binding.
  if(!billing.plan.publicPlanId)return reply({ok:false,error:'native_invoices_unavailable_use_portal'},503);
  const page=await(await publicBillingRuntime()).invoices(billing.plan.stripeCustomerId,{...(status?{status:status as InvoiceStatus}:{}),...(after?{after}:{})});
  return reply({ok:true,data:{state:'verified',...page}});
 }catch{return reply({ok:false,error:'invoices_unavailable_use_portal'},503);}
}
