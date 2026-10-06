/**
 * POST /api/dashboard/github-installation-start
 *
 * Creates a short-lived, single-use GitHub App installation handoff. The raw
 * browser state is returned once to GitHub but only its digest is persisted.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";
import { getGithubConfig, isGithubAppInstallationReady } from "@/lib/connectors/github/githubConfig";
import { prisma } from "@/lib/db";
import {
  startTenantIntegrationAuthorization,
  type TenantConnectionRepo,
} from "@/lib/integrations/tenantConnectionRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "invalid_request_origin" }, { status: 403 });
  }
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }

  const config = await getGithubConfig();
  const appSlug = config.appSlug ?? "";
  if (!isGithubAppInstallationReady(config, appSlug)) {
    return NextResponse.json({ ok: false, error: "github_not_configured" }, { status: 503 });
  }

  const callbackUrl = trustedIntegrationCallbackUrl("/api/integrations/github/install-callback");
  if (!callbackUrl) return NextResponse.json({ ok: false, error: "github_not_configured" }, { status: 503 });
  try {
    const authorization = await startTenantIntegrationAuthorization(
      prisma as unknown as TenantConnectionRepo,
      {
        organizationId: ctx.organizationId,
        provider: "github",
        redirectUri: callbackUrl,
        initiatedByUserId: ctx.userId,
      },
    );
    const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
    installUrl.searchParams.set("state", authorization.state);
    return NextResponse.json({ ok: true, data: { installUrl: installUrl.toString() } });
  } catch {
    // Do not reveal schema or credential-vault details to a browser client.
    return NextResponse.json({ ok: false, error: "authorization_unavailable" }, { status: 503 });
  }
}
