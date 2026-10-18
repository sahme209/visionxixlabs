import type {NextRequest} from "next/server";
import {handleCustomerPlanImport} from "@/lib/terraform/customerPlanHttp";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return handleCustomerPlanImport(request,(await params).id);}
