import type {NextRequest} from "next/server";
import {handleCustomerPlanProfile} from "@/lib/terraform/customerPlanHttp";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleCustomerPlanProfile(request,(await params).id);}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleCustomerPlanProfile(request,(await params).id);}
