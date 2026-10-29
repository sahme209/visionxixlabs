import type {NextRequest} from 'next/server';
import {handleReadinessRun} from '@/lib/axiom/bot/readinessRunHttp';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const handle=async(request:NextRequest,context:{params:Promise<{runId:string}>})=>handleReadinessRun(request,(await context.params).runId);
export const GET=handle;
export const DELETE=handle;
