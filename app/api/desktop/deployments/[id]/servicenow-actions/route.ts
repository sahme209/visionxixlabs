import type {NextRequest} from 'next/server';import {handleServiceNowTicketLifecycle} from '@/lib/desktop/serviceNowTicketLifecycleHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
async function handle(r:NextRequest,c:{params:Promise<{id:string}>}){return handleServiceNowTicketLifecycle(r,(await c.params).id)}export{handle as GET,handle as POST};
