import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";
import { prisma } from "@/lib/db";
import { buildSlackInstallUrl } from "@/lib/integrations/slack/slackOauth";
import { startTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Starts a tenant-bound Slack OAuth handoff. The browser receives only the
 * short-lived state needed by Slack; Axiom stores its digest, never the raw state. */
export async function POST(_request: NextRequest): Promise<Response> {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.organizationId || !context.userId) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: context.email, roles: context.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }
  const clientId = process.env.SLACK_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 503 });
  }

  const redirectUri = trustedIntegrationCallbackUrl("/api/integrations/slack/callback");
  if (!redirectUri) return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 503 });
  try {
    const authorization = await startTenantIntegrationAuthorization(
      prisma as unknown as TenantConnectionRepo,
      { organizationId: context.organizationId, provider: "slack", redirectUri, initiatedByUserId: context.userId },
    );
    return NextResponse.json({
      ok: true,
      data: {
        // Initial release use is notification-only. Broader chat, command, DM,
        // or private-channel permissions need a separately reviewed feature.
        consentUrl: buildSlackInstallUrl({ clientId, redirectUri, state: authorization.state, scopes: ["channels:read", "chat:write"] }),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "authorization_unavailable" }, { status: 503 });
  }
}
