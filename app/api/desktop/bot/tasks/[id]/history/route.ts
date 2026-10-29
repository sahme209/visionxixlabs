import type {NextRequest} from "next/server";
import {handleSavedBotTaskHistory} from "@/lib/axiom/bot/savedTaskHttp";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleSavedBotTaskHistory(request,(await params).id)}
