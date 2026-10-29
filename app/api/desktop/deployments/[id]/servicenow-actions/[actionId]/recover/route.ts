import type {NextRequest} from 'next/server';import {handleServiceNowTicketLifecycle} from '@/lib/desktop/serviceNowTicketLifecycleHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
export async function POST(r:NextRequest,c:{params:Promise<{id:string;actionId:string}>}){const p=await c.params;return handleServiceNowTicketLifecycle(r,p.id,p.actionId,'recover')}
