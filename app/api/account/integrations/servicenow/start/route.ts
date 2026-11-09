import {NextResponse,type NextRequest} from 'next/server';
import {currentContext} from '@/lib/auth/currentContext';
import {serviceNowConnectionHttp} from '@/lib/integrations/servicenow/serviceNowConnectionRuntime';
import {refuseNewConnectionWhenEnrolled} from '@/lib/governance/intelligence/enrolledRefusal';
export const dynamic='force-dynamic';
export const runtime='nodejs';
/** Governance M03: a brand-new ServiceNow connection waits while enrolled, before any
 * provider consent; re-authorizing an existing one still works. All other checks stay in
 * the ServiceNow connection handler. */
export async function POST(request:NextRequest){
 const context=await currentContext().catch(()=>null);
 if(context?.isAuthenticated&&context.organizationId&&await refuseNewConnectionWhenEnrolled(String(context.organizationId),'servicenow'))return NextResponse.json({ok:false,error:'governance_enrolled_connection_increase'},{status:409,headers:{'Cache-Control':'no-store'}});
 return serviceNowConnectionHttp.start(request);
}
