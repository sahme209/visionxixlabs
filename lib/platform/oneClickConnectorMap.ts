/**
 * One-click connector flow map.
 *
 * For every connector in lib/connectors/connectorRegistry.ts, declares
 * the one-click setup flow that drives the Connect button on
 * /dashboard/connector-store. Connectors not listed here fall back to
 * the legacy env-var setup wizard.
 */

import type { ConnectorRecord } from "@/lib/connectors/connectorRegistry";
import type { ConnectorOneClickDescriptor, ConnectorOneClickFlow } from "@/lib/platform/tenantConnections";

const FLOWS: Readonly<Record<string, ConnectorOneClickFlow>> = {
  // Cloud — IAM role / SP / SA flows (already have admin test endpoints)
  aws: {
    kind: "iam_role_setup",
    provider: "aws",
    trustPolicyTemplate: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::VISIONXIXLABS_ACCOUNT_ID:user/broker"},"Action":"sts:AssumeRole","Condition":{"StringEquals":{"sts:ExternalId":"TENANT_EXTERNAL_ID"}}}]}',
  },
  azure: {
    kind: "paste_form",
    fields: [
      { name: "tenantId",       label: "Directory (tenant) ID",   secret: false, placeholder: "00000000-0000-0000-0000-000000000000" },
      { name: "clientId",       label: "Application (client) ID", secret: false, placeholder: "00000000-0000-0000-0000-000000000000" },
      { name: "clientSecret",   label: "Client secret value",     secret: true,  placeholder: "mVr8Q~..." },
      { name: "subscriptionId", label: "Subscription ID",         secret: false, placeholder: "00000000-0000-0000-0000-000000000000" },
    ],
  },
  gcp: {
    kind: "paste_form",
    fields: [
      { name: "projectId",         label: "Project ID",            secret: false, placeholder: "my-gcp-project" },
      { name: "serviceAccountJson", label: "Service account JSON", secret: true,  placeholder: '{ "type": "service_account", ... }' },
    ],
  },

  // Source control
  github: {
    kind: "oauth_redirect",
    provider: "github_app",
    scopes: ["repo:read", "workflow:read", "actions:read"],
  },
  gitlab: {
    kind: "paste_form",
    fields: [
      { name: "apiUrl",     label: "GitLab API URL",       secret: false, placeholder: "https://gitlab.com/api/v4" },
      { name: "accessToken", label: "Personal access token", secret: true,  placeholder: "glpat-..." },
    ],
  },

  // Messaging — OAuth
  slack:    { kind: "oauth_redirect", provider: "slack",     scopes: ["chat:write", "channels:read"] },
  msteams:  { kind: "oauth_redirect", provider: "microsoft", scopes: ["Channel.ReadBasic.All", "ChatMessage.Send"] },

  // Ticketing — OAuth
  jira:     { kind: "oauth_redirect", provider: "atlassian", scopes: ["read:jira-work", "write:jira-work"] },
  linear: {
    kind: "paste_form",
    fields: [{ name: "apiKey", label: "Linear API key", secret: true, placeholder: "lin_api_..." }],
  },

  // Incident
  servicenow: {
    kind: "paste_form",
    fields: [
      { name: "instanceUrl", label: "ServiceNow instance URL", secret: false, placeholder: "https://dev12345.service-now.com" },
      { name: "username",    label: "Username",                secret: false },
      { name: "password",    label: "Password / API token",    secret: true },
    ],
  },
  pagerduty: {
    kind: "paste_form",
    fields: [{ name: "apiKey", label: "PagerDuty API key", secret: true, placeholder: "u+..." }],
  },
  opsgenie: {
    kind: "paste_form",
    fields: [{ name: "apiKey", label: "Opsgenie API key", secret: true, placeholder: "..." }],
  },

  // Observability
  dynatrace: {
    kind: "paste_form",
    fields: [
      { name: "environmentUrl", label: "Environment URL",   secret: false, placeholder: "https://abc12345.live.dynatrace.com" },
      { name: "apiToken",       label: "API token",         secret: true,  placeholder: "dt0c01.SAMPLE..." },
    ],
  },
  grafana: {
    kind: "paste_form",
    fields: [
      { name: "instanceUrl", label: "Grafana instance URL", secret: false, placeholder: "https://yourcompany.grafana.net" },
      { name: "apiKey",      label: "API key",              secret: true,  placeholder: "glsa_..." },
    ],
  },
  prometheus: {
    kind: "paste_form",
    fields: [
      { name: "endpoint", label: "Prometheus query endpoint", secret: false, placeholder: "https://prom.example.com" },
      { name: "bearerToken", label: "Bearer token (optional)", secret: true },
    ],
  },
  datadog: {
    kind: "paste_form",
    fields: [
      { name: "site",   label: "Datadog site",    secret: false, placeholder: "datadoghq.com / datadoghq.eu / us3.datadoghq.com" },
      { name: "apiKey", label: "API key",         secret: true },
      { name: "appKey", label: "Application key", secret: true },
    ],
  },
  new_relic: {
    kind: "paste_form",
    fields: [
      { name: "region",     label: "Region",      secret: false, placeholder: "US or EU" },
      { name: "userApiKey", label: "User API key", secret: true, placeholder: "NRAK-..." },
    ],
  },
  splunk: {
    kind: "paste_form",
    fields: [
      { name: "endpoint", label: "Splunk endpoint", secret: false, placeholder: "https://splunk.example.com:8089" },
      { name: "token",    label: "Auth token",      secret: true },
    ],
  },

  // Security
  wiz: {
    kind: "paste_form",
    fields: [
      { name: "clientId",     label: "Service account client id", secret: false },
      { name: "clientSecret", label: "Service account secret",    secret: true },
    ],
  },
  snyk: {
    kind: "paste_form",
    fields: [
      { name: "orgId",   label: "Snyk org id", secret: false },
      { name: "apiKey",  label: "API token",   secret: true },
    ],
  },
  prisma_cloud: {
    kind: "paste_form",
    fields: [
      { name: "endpoint",       label: "API endpoint",         secret: false, placeholder: "https://api.prismacloud.io" },
      { name: "accessKey",      label: "Access key ID",         secret: false },
      { name: "secretKey",      label: "Secret key",            secret: true },
    ],
  },
  crowdstrike: {
    kind: "oauth_redirect",
    provider: "microsoft", // placeholder — CrowdStrike uses OAuth2; provider key is approximate.
    scopes: ["detects:read", "hosts:read"],
  },

  // IaC / infra
  terraform: {
    kind: "paste_form",
    fields: [
      { name: "tfcOrgName", label: "Terraform Cloud org",  secret: false },
      { name: "tfcToken",   label: "API token",            secret: true },
    ],
  },

  // Desktop runtime
  desktop: { kind: "desktop_pairing", pairingCodeTtlSeconds: 600 },

  // Audit
  audit_export: { kind: "webhook_setup", signedSecretRequired: true },
};

const BUTTON_HELPERS: Readonly<Record<string, string>> = {
  oauth_redirect:   "Sign in with the provider — we never see your password.",
  paste_form:       "Paste credentials once. We store them encrypted, scoped to this workspace.",
  iam_role_setup:   "Create a cross-account IAM role with the policy we generate.",
  desktop_pairing:  "Pair the desktop app via a short-lived code (no permanent secret).",
  webhook_setup:    "Receive a signed webhook URL — paste it into the source system.",
};

export function describeOneClick(record: ConnectorRecord): ConnectorOneClickDescriptor {
  const flow = FLOWS[record.id];
  const ready = record.status === "live" || record.status === "preview" || record.status === "expanding";
  if (!flow) {
    return {
      connectorId: record.id,
      buttonLabel: ready ? "Set up" : "Notify me",
      buttonHelper: ready ? "Guided env-var setup wizard." : "We'll email you when this connector ships.",
      flow: { kind: "paste_form", fields: [] },
      ready,
      notReadyReason: ready ? undefined : "planned",
    };
  }
  return {
    connectorId: record.id,
    buttonLabel: ready ? labelFor(flow) : "Notify me",
    buttonHelper: ready ? (BUTTON_HELPERS[flow.kind] ?? "Connect this source.") : "We'll email you when this connector ships.",
    flow,
    ready,
    notReadyReason: ready ? undefined : "planned",
  };
}

function labelFor(flow: ConnectorOneClickFlow): string {
  switch (flow.kind) {
    case "oauth_redirect":  return "Connect via OAuth";
    case "paste_form":      return "Paste credentials";
    case "iam_role_setup":  return "Set up IAM role";
    case "desktop_pairing": return "Pair desktop app";
    case "webhook_setup":   return "Set up webhook";
  }
}
