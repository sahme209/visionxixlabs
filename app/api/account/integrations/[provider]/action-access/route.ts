import type {NextRequest} from 'next/server';
import {startConnectedActionConsent} from '@/lib/integrations/connectedActionConsentHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
export async function POST(request:NextRequest,{params}:{params:Promise<{provider:string}>}){return startConnectedActionConsent(request,(await params).provider)}
