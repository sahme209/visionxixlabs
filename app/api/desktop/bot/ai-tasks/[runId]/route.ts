import type {NextRequest} from 'next/server';
import {handleAiTask} from '@/lib/axiom/bot/aiTaskHttp';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{runId:string}>};
export const GET=async(request:NextRequest,context:Context)=>handleAiTask(request,(await context.params).runId);
export const DELETE=async(request:NextRequest,context:Context)=>handleAiTask(request,(await context.params).runId);
