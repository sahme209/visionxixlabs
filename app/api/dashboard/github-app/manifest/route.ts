/**
 * GET /api/dashboard/github-app/manifest
 *
 * Admin-gated. Returns the GitHub App Manifest JSON the dashboard's
 * "Create GitHub App" button submits (as a real HTML form POST — not
 * fetch) to https://github.com/settings/apps/new. This is the one-time
 * platform-operator setup step; it never touches a tenant's workspace
 * data, mutates nothing, and returns no secret — just a manifest the
 * browser then hands to GitHub itself.
 *
 * Deliberately NOT same-origin-checked: isSameOriginRequest's check
 * (lib/auth/requestOrigin.ts) compares the inbound `Origin` header
 * against the request's own host, which is the right defense for a
 * state-changing mutation reachable via a plain form POST — but
 * browsers routinely omit the `Origin` header on same-origin GET
 * requests, so applying that check here made this route fail for
 * essentially every legitimate caller. Session auth + the platform-admin
 * check below are the real gate for a read-only GET like this one.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isPlatformAdmin } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { startTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";
import { trustedAxiomUrl } from "@/lib/integrations/trustedCallbackUrl";
import { buildGithubAppManifest } from "@/lib/connectors/github/githubAppManifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest): Promise<Response> {
  void _request;
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isPlatformAdmin(ctx.email)) {
    return NextResponse.json({ ok: false, error: "platform_admin_required" }, { status: 403 });
  }

  // Derive the trusted origin from Axiom's own configured app URL, never
  // from an inbound Host header.
  const trustedRoot = trustedAxiomUrl("/");
  if (!trustedRoot) {
    return NextResponse.json({ ok: false, error: "trusted_origin_unavailable" }, { status: 503 });
  }
  const origin = new URL(trustedRoot).origin;
  const manifest = buildGithubAppManifest({ origin });
  return NextResponse.json({ ok: true, data: { manifest, createUrl: "https://github.com/settings/apps/new" } }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Initiation is a protected write; GET remains a nonsecret, read-only preview. */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) return NextResponse.json({ok:false,error:"invalid_request_origin"},{status:403});
  const ctx=await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) return NextResponse.json({ok:false,error:"auth_required"},{status:401});
  if (!isPlatformAdmin(ctx.email)) return NextResponse.json({ok:false,error:"platform_admin_required"},{status:403});
  const redirectUri=trustedAxiomUrl("/api/integrations/github/app-manifest-callback");
  if (!redirectUri) return NextResponse.json({ok:false,error:"trusted_origin_unavailable"},{status:503});
  try {
    const authorization=await startTenantIntegrationAuthorization(prisma as unknown as TenantConnectionRepo,{organizationId:ctx.organizationId,initiatedByUserId:ctx.userId,provider:"github",redirectUri});
    const createUrl=new URL("https://github.com/settings/apps/new");createUrl.searchParams.set("state",authorization.state);
    return NextResponse.json({ok:true,data:{manifest:buildGithubAppManifest({origin:new URL(redirectUri).origin}),createUrl:createUrl.toString()}},{headers:{"Cache-Control":"private, no-store"}});
  } catch {return NextResponse.json({ok:false,error:"setup_initiation_unavailable"},{status:503});}
}
