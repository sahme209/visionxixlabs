/**
 * Pure tenant-integration catalog.
 *
 * Single declarative source of truth for which integrations the
 * platform supports + what each one needs to be fully configured.
 * The dashboard renders this; the catalog also drives an installer-
 * readiness check.
 *
 * Pure / deterministic.
 */

import type { IntegrationName } from "./integrationHealthMonitor";

export interface IntegrationDefinition {
  name: IntegrationName;
  label: string;
  category: "chatops" | "email" | "calendar" | "paging" | "generic";
  /** What modes are supported ("webhook", "oauth_bot", "graph_user"). */
  supportedModes: readonly string[];
  /** Per-mode required config keys. Caller checks tenant state against these. */
  requiredKeysByMode: Record<string, readonly string[]>;
  /** Operator-readable setup help. */
  setupNote: string;
}

const CATALOG: readonly IntegrationDefinition[] = [
  {
    name: "slack",
    label: "Slack",
    category: "chatops",
    supportedModes: ["webhook", "bot_token"],
    requiredKeysByMode: {
      webhook:   ["SLACK_WEBHOOK_URL"],
      bot_token: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_BOT_TOKEN"],
    },
    setupNote: "Webhook is fine for outbound only. Install the Axiom Slack app (OAuth) for replies + slash commands.",
  },
  {
    name: "teams",
    label: "Microsoft Teams",
    category: "chatops",
    supportedModes: ["webhook", "graph_bot"],
    requiredKeysByMode: {
      webhook:   ["TEAMS_WEBHOOK_URL"],
      graph_bot: ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "TEAMS_CHAT_ID"],
    },
    setupNote: "Incoming webhooks are simple. For richer flows (post into Teams chats), install the Axiom Teams app via Azure AD.",
  },
  {
    name: "outlook",
    label: "Outlook (Microsoft 365)",
    category: "email",
    supportedModes: ["graph_user", "graph_app"],
    requiredKeysByMode: {
      graph_user: ["MS_CLIENT_ID", "MS_TENANT_ID", "MS_CLIENT_SECRET", "OUTLOOK_REDIRECT_URI"],
      graph_app:  ["MS_CLIENT_ID", "MS_TENANT_ID", "MS_CLIENT_SECRET", "OUTLOOK_SEND_AS_UPN"],
    },
    setupNote: "graph_user: each operator signs in once and Axiom sends mail/calendar invites as them. graph_app: a service principal sends as a shared mailbox.",
  },
  {
    name: "gmail",
    label: "Gmail (Google Workspace)",
    category: "email",
    supportedModes: ["oauth_user"],
    requiredKeysByMode: {
      oauth_user: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REDIRECT_URI"],
    },
    setupNote: "Operator signs in with Google and grants 'gmail.send' scope.",
  },
  {
    name: "pagerduty",
    label: "PagerDuty",
    category: "paging",
    supportedModes: ["events_v2"],
    requiredKeysByMode: {
      events_v2: ["PAGERDUTY_ROUTING_KEY"],
    },
    setupNote: "Per-service routing key under Service > Integrations > Events API v2.",
  },
  {
    name: "webhook_generic",
    label: "Generic webhook",
    category: "generic",
    supportedModes: ["webhook"],
    requiredKeysByMode: {
      webhook: ["GENERIC_WEBHOOK_URL", "GENERIC_WEBHOOK_SECRET"],
    },
    setupNote: "POSTs a signed JSON envelope. Verify the signature with the supplied secret.",
  },
];

export function listIntegrations(): IntegrationDefinition[] { return [...CATALOG]; }

export function findIntegration(name: IntegrationName): IntegrationDefinition | null {
  return CATALOG.find((c) => c.name === name) ?? null;
}

export interface ReadinessCheckRow {
  name: IntegrationName;
  mode: string;
  configured: boolean;
  missingKeys: string[];
}

export function checkIntegrationReadiness(input: {
  /** Per-integration mode chosen by the tenant. */
  modeByIntegration: Partial<Record<IntegrationName, string>>;
  /** Booleans for which env keys are set (NEVER the secret values). */
  envSet: Record<string, boolean>;
}): ReadinessCheckRow[] {
  const rows: ReadinessCheckRow[] = [];
  for (const def of CATALOG) {
    const mode = input.modeByIntegration[def.name];
    if (!mode) continue;
    const required = def.requiredKeysByMode[mode];
    if (!required) continue;
    const missingKeys = required.filter((k) => !input.envSet[k]);
    rows.push({
      name: def.name,
      mode,
      configured: missingKeys.length === 0,
      missingKeys,
    });
  }
  return rows;
}
