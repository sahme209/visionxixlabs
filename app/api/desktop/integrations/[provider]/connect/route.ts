import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { getGithubConfig, isGithubAppInstallationReady } from "@/lib/connectors/github/githubConfig";
import { buildSlackInstallUrl } from "@/lib/integrations/slack/slackOauth";
import { startTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";
import { trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConnectProvider = "github" | "slack" | "teams" | "linear";

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Creates a short-lived provider handoff for an authenticated desktop admin.
 * The desktop receives only the provider consent URL; client secrets, PKCE
 * verifiers, and resulting provider tokens remain server-side. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, {
    requiredScope: "pipeline:read",
    route: "POST /api/desktop/integrations/[provider]/connect",
    allowApiKey: false,
    requireWorkspaceAdmin: true,
  });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });

  const { provider: rawProvider } = await params;
  if (!["github", "slack", "teams", "linear"].includes(rawProvider)) {
    return NextResponse.json({ ok: false, error: "unsupported_provider" }, { status: 404 });
  }
  const provider = rawProvider as ConnectProvider;
  const callbackPath = provider === "github" ? "/api/integrations/github/install-callback" : `/api/integrations/${provider}/callback`;
  const redirectUri = trustedIntegrationCallbackUrl(callbackPath);
  if (!redirectUri) return NextResponse.json({ ok: false, error: `${provider}_not_configured` }, { status: 503 });

  let verifier: string | undefined;
  let consentUrl: URL;
  if (provider === "github") {
    const config = await getGithubConfig();
    const appSlug = config.appSlug ?? "";
    if (!isGithubAppInstallationReady(config, appSlug)) return NextResponse.json({ ok: false, error: "github_not_configured" }, { status: 503 });
    consentUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  } else if (provider === "slack") {
    const clientId = process.env.SLACK_CLIENT_ID?.trim() ?? "";
    if (!clientId || !process.env.SLACK_CLIENT_SECRET?.trim()) return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 503 });
    consentUrl = new URL("https://slack.com/oauth/v2/authorize");
  } else if (provider === "teams") {
    const clientId = process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
    const tenant = process.env.MICROSOFT_TENANT_ID?.trim() ?? "";
    if (!clientId || !tenant || !process.env.MICROSOFT_CLIENT_SECRET?.trim()) return NextResponse.json({ ok: false, error: "teams_not_configured" }, { status: 503 });
    verifier = randomBytes(48).toString("base64url");
    consentUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
  } else {
    const clientId = process.env.LINEAR_CLIENT_ID?.trim() ?? "";
    if (!clientId || !process.env.LINEAR_CLIENT_SECRET?.trim()) return NextResponse.json({ ok: false, error: "linear_not_configured" }, { status: 503 });
    verifier = randomBytes(48).toString("base64url");
    consentUrl = new URL("https://linear.app/oauth/authorize");
  }

  try {
    const authorization = await startTenantIntegrationAuthorization(prisma as unknown as TenantConnectionRepo, {
      organizationId: session.organizationId,
      provider,
      redirectUri,
      initiatedByUserId: session.userId,
      pkceVerifier: verifier,
    });
    if (provider === "github") {
      consentUrl.searchParams.set("state", authorization.state);
    } else if (provider === "slack") {
      const clientId = process.env.SLACK_CLIENT_ID!.trim();
      consentUrl = new URL(buildSlackInstallUrl({ clientId, redirectUri, state: authorization.state, scopes: ["channels:read", "chat:write"] }));
    } else if (provider === "teams") {
      consentUrl.search = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!.trim(), response_type: "code", redirect_uri: redirectUri,
        response_mode: "query", scope: "openid offline_access User.Read", state: authorization.state,
        code_challenge: pkceChallenge(verifier!), code_challenge_method: "S256",
      }).toString();
    } else {
      consentUrl.search = new URLSearchParams({
        client_id: process.env.LINEAR_CLIENT_ID!.trim(), redirect_uri: redirectUri, response_type: "code",
        scope: "read,issues:create", state: authorization.state, actor: "app", prompt: "consent",
        code_challenge: pkceChallenge(verifier!), code_challenge_method: "S256",
      }).toString();
    }
    return NextResponse.json({ ok: true, data: { consentUrl: consentUrl.toString() } });
  } catch {
    return NextResponse.json({ ok: false, error: "authorization_unavailable" }, { status: 503 });
  }
}
