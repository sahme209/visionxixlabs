import {NextRequest} from 'next/server';import {handleTicketGovernanceReview} from '@/lib/desktop/ticketGovernanceRoutes';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){return handleTicketGovernanceReview(request,'lookup')}
