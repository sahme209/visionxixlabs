import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";
import { prisma } from "@/lib/db";
import { beginJiraAuthorization, type JiraAuthorizationActor } from "@/lib/integrations/jira/jiraAuthorization";
import type { TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest): Promise<Response> {
 if (!isSameOriginRequest(request)) return NextResponse.json({ok:false,error:"invalid_request_origin"},{status:403});
 const context=await currentContext();
 if(!context.isAuthenticated||!context.organizationId||!context.userId)return NextResponse.json({ok:false,error:"auth_required"},{status:401});
 if(!isAdminOrOwner({email:context.email,roles:context.roles}))return NextResponse.json({ok:false,error:"workspace_owner_required"},{status:403});
 const clientId=process.env.JIRA_CLIENT_ID?.trim()??"",clientSecret=process.env.JIRA_CLIENT_SECRET?.trim()??"";
 const redirectUri=trustedIntegrationCallbackUrl("/api/integrations/jira/callback");
 if(!clientId||!clientSecret||!redirectUri)return NextResponse.json({ok:false,error:"jira_not_configured"},{status:503});
 const actor:JiraAuthorizationActor={organizationId:context.organizationId,userId:context.userId,canManageConnections:true};
 try { const result=await beginJiraAuthorization(prisma as unknown as TenantConnectionRepo,{actor,clientId,redirectUri}); return NextResponse.json({ok:true,data:{consentUrl:result.consentUrl,expiresAt:result.expiresAt.toISOString()}}); }
 catch { return NextResponse.json({ok:false,error:"authorization_unavailable"},{status:503}); }
}
