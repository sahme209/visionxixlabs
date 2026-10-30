import 'server-only';
import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/db';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createTicketGovernanceHttp} from './ticketGovernanceHttp';
import {createTicketGovernanceRequestService} from './ticketGovernanceRequestService';
const handler=createTicketGovernanceHttp((request,scope)=>createTicketGovernanceRequestService(request,prisma as unknown as ReleaseOperationPlanRepo,scope));
/** Local rollout boundary. No existing ticket-write switch enables these reviews. */
export function handleTicketGovernanceReview(request:NextRequest,mode:'prepare'|'get'|'approve'|'cancel'|'lookup',reviewId?:string){
 if(process.env.AXIOM_TICKET_GOVERNANCE_REVIEWS_ENABLED!=='true')return NextResponse.json({ok:false,error:'ticket_governance_disabled',retryAllowed:false},{status:503,headers:{'Cache-Control':'private, no-store'}});
 return handler(request,mode,reviewId);
}
