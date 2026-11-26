import type {NextRequest} from "next/server";
import {handleSavedBotTaskRuns} from "@/lib/axiom/bot/savedTaskHttp";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleSavedBotTaskRuns(request,(await params).id)}
