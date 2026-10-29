import type {NextRequest} from 'next/server';
import {handleTicketGovernanceReview} from '@/lib/desktop/ticketGovernanceRoutes';
export const runtime='nodejs';
export async function GET(request:NextRequest,context:{params:Promise<{reviewId:string}>}){const{reviewId}=await context.params;return handleTicketGovernanceReview(request,'get',reviewId)}
