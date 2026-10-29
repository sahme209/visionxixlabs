import {handleServiceNowTicketLifecycle} from '@/lib/desktop/serviceNowTicketLifecycleHttp';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function POST(request:import('next/server').NextRequest,{params}:{params:Promise<{id:string;actionId:string}>}){const {id,actionId}=await params;return handleServiceNowTicketLifecycle(request,id,actionId,'recovery-propose')}
