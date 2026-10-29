import type {NextRequest} from 'next/server';
import {handleTicketGovernanceReview} from '@/lib/desktop/ticketGovernanceRoutes';
export const runtime='nodejs';
export async function POST(request:NextRequest,context:{params:Promise<{reviewId:string}>}){const{reviewId}=await context.params;return handleTicketGovernanceReview(request,'cancel',reviewId)}
