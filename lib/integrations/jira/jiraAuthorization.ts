import "server-only";
import { buildJiraConsentUrl } from "./jiraOAuth";
import { consumeTenantIntegrationAuthorization, startTenantIntegrationAuthorization, type TenantConnectionRepo } from "../tenantConnectionRepo";

/** Supplied by a trusted route after resolving current tenant membership. */
export interface JiraAuthorizationActor {
  organizationId: string;
  userId: string;
  canManageConnections: boolean;
}
function authorized(actor: JiraAuthorizationActor | null): actor is JiraAuthorizationActor {
  return !!actor && actor.canManageConnections === true &&
    typeof actor.organizationId === "string" && !!actor.organizationId.trim() &&
    typeof actor.userId === "string" && !!actor.userId.trim();
}

export async function beginJiraAuthorization(repo: TenantConnectionRepo, input: {
  actor: JiraAuthorizationActor | null; clientId: string; redirectUri: string; now?: Date;
}): Promise<{ consentUrl: string; expiresAt: Date }> {
  if (!authorized(input.actor)) throw new Error("jira_authorization_unavailable");
  // Validate platform configuration before persisting any bearer challenge.
  buildJiraConsentUrl({ ...input, state: "a".repeat(43) });
  const attempt = await startTenantIntegrationAuthorization(repo, {
    organizationId: input.actor.organizationId, initiatedByUserId: input.actor.userId,
    provider: "jira", redirectUri: input.redirectUri, now: input.now,
  });
  return { consentUrl: buildJiraConsentUrl({ ...input, state: attempt.state }), expiresAt: attempt.expiresAt };
}

/** A callback must resolve current actor authorization before invoking this.
 * Only a successful one-time claim may precede an OAuth code exchange. */
export async function consumeJiraAuthorization(repo: TenantConnectionRepo, input: {
  actor: JiraAuthorizationActor | null; state: string; redirectUri: string; now?: Date;
}): Promise<{ ok: boolean }> {
  if (!authorized(input.actor)) return { ok: false };
  const result = await consumeTenantIntegrationAuthorization(repo, {
    state: input.state, provider: "jira", now: input.now,
    expected: { organizationId: input.actor.organizationId, initiatedByUserId: input.actor.userId, redirectUri: input.redirectUri },
  });
  return { ok: result.ok };
}
