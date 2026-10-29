import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { prisma } from "@/lib/db";
import { consumeJiraAuthorization, type JiraAuthorizationActor } from "@/lib/integrations/jira/jiraAuthorization";
import { exchangeJiraAuthorizationCode } from "@/lib/integrations/jira/jiraOAuth";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { trustedAxiomUrl, matchesTrustedIntegrationCallbackUrl, trustedIntegrationCallbackUrl } from "@/lib/integrations/trustedCallbackUrl";
import type { TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";
import { encryptScopedCredential } from "@/lib/security/credentialVault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type ConnectionRepo = TenantConnectionRepo & { tenantIntegrationConnection: {
  findUnique(args: { where: { organizationId_provider: { organizationId: string; provider: string } }; select: { id: true } }): Promise<{ id: string } | null>;
  create(args: { data: { id: string; organizationId: string; provider: string; status: string; encryptedCredential: string; externalAccountId: null; scopesJson: string[]; consentedByUserId: string; lastValidatedAt: null } }): Promise<unknown>;
} };
function returnToCompanion(status: string): Response {
  const destination = trustedAxiomUrl(`/auth/success?integration=jira&status=${encodeURIComponent(status)}`);
  return destination ? NextResponse.redirect(destination) : NextResponse.json({ ok: false, error: "trusted_return_url_unavailable" }, { status: 503 });
}
function codeFrom(url: URL): string | null {
  const all = url.searchParams.getAll("code");
  const value = all.length === 1 ? all[0] : "";
  return value && value.length <= 2048 && !/[\r\n]/.test(value) ? value : null;
}
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const stateValues = url.searchParams.getAll("state");
  if(stateValues.some(state=>state.startsWith("jw1_"))){const {jiraTicketWriteHttp}=await import("@/lib/integrations/jira/jiraTicketWriteRuntime");return jiraTicketWriteHttp.callback(request);}
  if(stateValues.some(state=>state.startsWith("jr1_"))){const {jiraReporterHttp}=await import("@/lib/integrations/jira/jiraTicketWriteRuntime");return jiraReporterHttp.callback(request);}
  const codeValues = url.searchParams.getAll("code");
  if (stateValues.length !== 1 || !/^[A-Za-z0-9_-]{43,256}$/.test(stateValues[0]) || codeValues.length > 1) return returnToCompanion("invalid_state");
  const context = await currentContext();
  const actor: JiraAuthorizationActor | null = context.isAuthenticated && context.organizationId && context.userId &&
    isAdminOrOwner({ email: context.email, roles: context.roles })
    ? { organizationId: context.organizationId, userId: context.userId, canManageConnections: true }
    : null;
  const redirectUri = trustedIntegrationCallbackUrl("/api/integrations/jira/callback");
  if (!actor || !redirectUri) return returnToCompanion("authorization_required");
  // The stored redirect is platform-configured, but also bind this HTTP
  // request to that exact trusted origin before consuming its one-time state.
  // This prevents a Host/proxy alias from redeeming a code through the route.
  let callbackRequestMatches = false;
  try {
    const expected = new URL(redirectUri);
    callbackRequestMatches = url.origin === expected.origin && url.pathname === expected.pathname;
  } catch { /* A malformed configured callback is handled as invalid state. */ }
  if (!callbackRequestMatches) return returnToCompanion("invalid_state");
  const consumed = await consumeJiraAuthorization(prisma as unknown as TenantConnectionRepo, { actor, state: stateValues[0], redirectUri });
  if (!consumed.ok) return returnToCompanion("invalid_state");
  if (!matchesTrustedIntegrationCallbackUrl("/api/integrations/jira/callback", redirectUri)) return returnToCompanion("invalid_state");
  if (url.searchParams.has("error")) return returnToCompanion("declined");

  const clientId = process.env.JIRA_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.JIRA_CLIENT_SECRET?.trim() ?? "";
  const code = codeFrom(url);
  if (!code || !clientId || !clientSecret) return returnToCompanion("unavailable");
  const connections = (prisma as unknown as ConnectionRepo).tenantIntegrationConnection;
  try {
    const existing = await connections.findUnique({ where: { organizationId_provider: { organizationId: actor.organizationId, provider: "jira" } }, select: { id: true } });
    if (existing) return returnToCompanion("connection_exists");
  } catch { return returnToCompanion("unavailable"); }

  let token;
  try { token = await exchangeJiraAuthorizationCode({ clientId, clientSecret, redirectUri, code, signal: request.signal }); }
  catch { return returnToCompanion("exchange_failed"); }
  // Provider exchange is an asynchronous boundary; the initiating workspace
  // and management authority must still be current before storing credentials.
  const latest = await currentContext().catch(() => null);
  if (request.signal.aborted || !latest?.isAuthenticated || latest.organizationId !== actor.organizationId || latest.userId !== actor.userId ||
      !isAdminOrOwner({ email: latest.email, roles: latest.roles })) return returnToCompanion("authorization_required");
  const connectionId = randomUUID();
  let encryptedCredential: string;
  try {
    encryptedCredential = encryptScopedCredential(JSON.stringify({ accessToken: token.accessToken, refreshToken: token.refreshToken, expiresAt: token.expiresAt }), connectionCredentialContext({ organizationId: actor.organizationId, provider: "jira", connectionId }));
    await connections.create({ data: { id: connectionId, organizationId: actor.organizationId, provider: "jira", status: "pending", encryptedCredential, externalAccountId: null, scopesJson: token.scopes, consentedByUserId: actor.userId, lastValidatedAt: null } });
  } catch { return returnToCompanion("record_failed"); }
  return returnToCompanion("consent_recorded");
}
