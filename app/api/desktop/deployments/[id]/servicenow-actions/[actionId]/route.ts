import type {NextRequest} from 'next/server';import {handleServiceNowTicketLifecycle} from '@/lib/desktop/serviceNowTicketLifecycleHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
export async function DELETE(r:NextRequest,c:{params:Promise<{id:string;actionId:string}>}){const p=await c.params;return handleServiceNowTicketLifecycle(r,p.id,p.actionId,'cancel')}
export async function PATCH(r:NextRequest,c:{params:Promise<{id:string;actionId:string}>}){const p=await c.params;return handleServiceNowTicketLifecycle(r,p.id,p.actionId,'amend')}
