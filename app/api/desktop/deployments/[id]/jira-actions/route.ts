import type {NextRequest} from 'next/server';import {handleJiraTicketLifecycle} from '@/lib/desktop/jiraTicketLifecycleHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=30;
async function handle(request:NextRequest,context:{params:Promise<{id:string}>}){return handleJiraTicketLifecycle(request,(await context.params).id)}export{handle as GET,handle as POST};
