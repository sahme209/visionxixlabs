/**
 * POST /api/dashboard/github-installation-start
 *
 * Creates a short-lived, single-use GitHub App installation handoff. The raw
 * browser state is returned once to GitHub but only its digest is persisted.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import {
  startTenantIntegrationAuthorization,
  type TenantConnectionRepo,
} from "@/lib/integrations/tenantConnectionRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }

  const appSlug = process.env.GITHUB_APP_SLUG?.trim() ?? "";
  if (!appSlug) {
    return NextResponse.json({ ok: false, error: "github_not_configured" }, { status: 503 });
  }

  const callbackUrl = new URL("/api/integrations/github/install-callback", req.url).toString();
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
