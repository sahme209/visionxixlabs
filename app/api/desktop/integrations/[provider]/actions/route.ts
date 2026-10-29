import {NextRequest} from 'next/server';
import {handleConnectedActions} from '@/lib/desktop/connectedActionsHttp';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:NextRequest,context:{params:Promise<{provider:string}>}){return handleConnectedActions(request,(await context.params).provider)}
export async function POST(request:NextRequest,context:{params:Promise<{provider:string}>}){return handleConnectedActions(request,(await context.params).provider)}
