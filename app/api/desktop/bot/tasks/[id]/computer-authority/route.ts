import type {NextRequest} from 'next/server';
import {handleBotComputerOwner} from '@/lib/axiom/bot/computerOwnerHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleBotComputerOwner(request,(await params).id)}
