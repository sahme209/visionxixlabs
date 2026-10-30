import {NextRequest} from 'next/server';
import {handleAssociatedTicketActions} from '@/lib/desktop/associatedTicketActionsHttp';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest,context:{params:Promise<{reviewId:string}>}){return handleAssociatedTicketActions(request,(await context.params).reviewId)}
