import type {NextRequest} from 'next/server';import {handleJiraTicketLifecycle} from '@/lib/desktop/jiraTicketLifecycleHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
export async function POST(request:NextRequest,context:{params:Promise<{id:string;actionId:string}>}){const p=await context.params;return handleJiraTicketLifecycle(request,p.id,p.actionId,true)}
