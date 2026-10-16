import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { requestDashboardRestart } from "@/lib/releaseops/dashboardRestart";
export const dynamic = "force-dynamic";
export async function POST(request:NextRequest) {
  if(!isSameOriginRequest(request)) return NextResponse.json({ok:false,error:"invalid_origin"},{status:403});
  const context=await currentContext();
  if(!context.isAuthenticated || !context.organizationId || !context.userId) return NextResponse.json({ok:false,error:"auth_required"},{status:401});
  let body:unknown;
  try {body=await request.json();} catch {return NextResponse.json({ok:false,error:"invalid_payload"},{status:400});}
  if(!body || typeof body!=="object" || Array.isArray(body) || Object.keys(body).some(key=>key!=="releaseId") || !("releaseId" in body) || typeof body.releaseId!=="string" || !body.releaseId || body.releaseId.length>128) return NextResponse.json({ok:false,error:"invalid_payload"},{status:400});
  const result=await requestDashboardRestart(prisma,{organizationId:String(context.organizationId),userId:String(context.userId),releaseId:body.releaseId});
  const hints:Record<string,string>={
    restart_readiness_unverified:"Refresh release readiness after finalizing scope and configuration; resolve blockers before requesting a restart. This does not verify a source artifact.",
    restart_approval_evidence_unavailable:"This environment requires durable approval evidence that the legacy restart path cannot verify. Use the reviewed governance path; do not remove the approval policy to bypass this gate.",
    restart_change_window_unverified:"The legacy restart path cannot validate the configured release/change window. A reviewed window verifier is required.",
    release_scope_unverified:"Finalize an explicit release tag and full commit identity before requesting a restart.",
    deployment_outcome_unknown:"An existing or attempted workflow may have been accepted. Its claim and allowance remain held; reconcile the provider outcome before retrying.",
  };
  const bodyResult=result.body.ok?result.body:{...result.body,...(hints[result.body.error]?{hint:hints[result.body.error]}:{})};
  return NextResponse.json(bodyResult,{status:result.status});
}
