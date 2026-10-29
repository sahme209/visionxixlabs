import type {NextRequest} from 'next/server';
import {handleAiTasks} from '@/lib/axiom/bot/aiTaskHttp';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=90;
export const GET=(request:NextRequest)=>handleAiTasks(request);
export const POST=(request:NextRequest)=>handleAiTasks(request);
