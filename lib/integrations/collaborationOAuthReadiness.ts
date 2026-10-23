import "server-only";
import {trustedIntegrationCallbackUrl} from "./trustedCallbackUrl";

const REGISTRATION_KEYS = {
  slack: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
  teams: ["MICROSOFT_CLIENT_ID", "MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_SECRET"],
  linear: ["LINEAR_CLIENT_ID", "LINEAR_CLIENT_SECRET"],
} as const;

/** Configuration availability only; it never establishes consent or connection health. */
export function isCollaborationOAuthConfigured(provider: keyof typeof REGISTRATION_KEYS): boolean {
  return Boolean(trustedIntegrationCallbackUrl(`/api/integrations/${provider}/callback`)) &&
    REGISTRATION_KEYS[provider].every(key => Boolean(process.env[key]?.trim()));
}
