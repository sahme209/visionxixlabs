import type {NextRequest} from "next/server";
import {handleSavedBotTask} from "@/lib/axiom/bot/savedTaskHttp";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleSavedBotTask(request,(await params).id)}
export const PUT=GET;
