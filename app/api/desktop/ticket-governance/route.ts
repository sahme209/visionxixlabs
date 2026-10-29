import type {NextRequest} from 'next/server';
import {handleTicketGovernanceReview} from '@/lib/desktop/ticketGovernanceRoutes';
export const runtime='nodejs';
export function POST(request:NextRequest){return handleTicketGovernanceReview(request,'prepare')}
