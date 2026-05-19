/**
 * Canonical server-side env loader.
 *
 * Validates required env vars at first access + exposes typed accessors.
 * Server-only — never import from a client component. Client-safe feature
 * status comes from `lib/config/features.ts` (which is safe to import
 * anywhere — it reads booleans from the server-side answer via the
 * /api/config/features endpoint when needed).
 *
 * Rules encoded:
 *  - Required vars throw a clear error when missing.
 *  - Optional vars resolve to `undefined`; callers decide fallback.
 *  - Mode toggles (live / preview / disabled) are typed enums.
 *  - "NEXT_PUBLIC_*" keys are not accepted here — those belong to the
 *    client-safe surface.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeatureMode = "live" | "preview" | "disabled";

export interface AppEnv {
  /** Public app URL (e.g. https://visionxixlabs.com). Used for absolute links. */
  appUrl: string;
  /** NextAuth secret. Required for any auth flow. */
  nextAuthSecret?: string;
  /** Public origin NextAuth uses to build callback URLs. */
  nextAuthUrl?: string;
  /** Database URL — Prisma reads this directly; we expose for diagnostics. */
  databaseUrlSet: boolean;
  /** AI provider key presence — never the value. */
  aiProviders: { openai: boolean; anthropic: boolean; gemini: boolean };
  /** OAuth provider env presence. */
  oauth: { google: boolean; github: boolean };
  /** AWS broker credentials presence (server-only — we don't expose the value). */
  awsBrokerConfigured: boolean;
  /** AWS scan mode — drives the scanner branch. */
  awsScanMode: FeatureMode;
  /** AWS broker access key id (server-only — used by SDK extractors). */
  awsBrokerAccessKeyId?: string;
  /** AWS broker secret access key (server-only — used by SDK extractors). */
  awsBrokerSecretAccessKey?: string;
  /** Ambient AWS role ARN for tenant-scoped reads. */
  awsAmbientRoleArn?: string;
  /** Ambient AWS external id paired with the role. */
  awsAmbientExternalId?: string;
  /** Ambient AWS region (Cost Explorer pins us-east-1 regardless; this is the customer's primary). */
  awsAmbientRegion?: string;
  /** AWS Cost Explorer extractor opt-in (CE API has per-request cost). */
  awsCostExplorerEnabled: boolean;
  /** Skip AssumeRole and use broker credentials directly (single-account / test setups). */
  awsUseDirectCreds: boolean;
  /** Azure Cost Management extractor opt-in. */
  azureCostMgmtEnabled: boolean;
  /** Telemetry webhook shared secret — required for inbound /api/webhooks/telemetry. */
  telemetryWebhookSecret?: string;
  /** Incident webhook shared secret — required for inbound /api/webhooks/incident. */
  incidentWebhookSecret?: string;
  /** Autonomy scheduler opt-in — required before cron will run a cycle. */
  autonomySchedulerEnabled: boolean;
  /** AWS ECS extractor opt-in. */
  awsEcsExtractEnabled: boolean;
  /** AWS EKS extractor opt-in. */
  awsEksExtractEnabled: boolean;
  /** GitHub Actions extractor opt-in. */
  githubActionsExtractEnabled: boolean;
  /** AWS CloudWatch pull-based telemetry extractor opt-in. */
  awsCloudWatchPullEnabled: boolean;
  /** AWS Service Inventory extractor opt-in (Lambda + RDS + IAM + S3). */
  awsInventoryExtractEnabled: boolean;
  /** PagerDuty REST pull extractor opt-in + token. */
  pagerDutyPullEnabled: boolean;
  pagerDutyApiToken?: string;
  /** Datadog REST pull extractor opt-in + keys + site. */
  datadogPullEnabled: boolean;
  datadogApiKey?: string;
  datadogAppKey?: string;
  datadogSite?: string;
  /** Sentry REST pull extractor opt-in + token + org. */
  sentryPullEnabled: boolean;
  sentryAuthToken?: string;
  sentryOrg?: string;
  sentryBaseUrl?: string;
  /** GHCR container inventory extractor opt-in + org + deep-inspect flag. */
  ghcrExtractEnabled: boolean;
  ghcrOrg?: string;
  ghcrDeepInspect: boolean;
  /** Outbound notification channels — autonomy halts notify back. */
  slackWebhookUrl?: string;
  teamsWebhookUrl?: string;
  outboundWebhookUrl?: string;
  outboundWebhookSecret?: string;
  /** Azure live inventory extractor opt-in. */
  azureInventoryExtractEnabled: boolean;
  /** GCP live inventory extractor opt-in. */
  gcpInventoryExtractEnabled: boolean;
  /** GitHub deep posture extractor opt-in (PRs / Dependabot / CodeQL / branch protection). */
  githubDeepPostureEnabled: boolean;
  /** Vercel deployments extractor opt-in + token + project + team. */
  vercelDeploymentsEnabled: boolean;
  vercelToken?: string;
  vercelProjectId?: string;
  vercelTeamId?: string;
  /** Vercel cron secret — pre-shared header guarding the cron route. */
  cronSecret?: string;
  /** Azure service-principal credentials presence (server-only). */
  azureConfigured: boolean;
  /** Azure scan mode. */
  azureScanMode: FeatureMode;
  /** Azure default subscription id for ambient validation. */
  azureSubscriptionId?: string;
  /** Azure tenant id for ambient validation. */
  azureTenantId?: string;
  /** GCP credentials presence (private key or service account JSON, server-only). */
  gcpConfigured: boolean;
  /** GCP scan mode. */
  gcpScanMode: FeatureMode;
  /** GCP default project id for ambient validation. */
  gcpProjectId?: string;
  /** GitHub sync mode. */
  githubSyncMode: FeatureMode;
  /** GitHub personal access token presence — practical live path without full OAuth roundtrip. */
  githubPatConfigured: boolean;
  /** GitHub App credentials presence. */
  githubAppConfigured: boolean;
  /** GitHub default org/login for unauthenticated browses (UI hint only — not used for live calls). */
  githubDefaultOrg?: string;
  /** Desktop runtime mode. */
  desktopMode: FeatureMode;
  /** Desktop downloads — false unless real signed binaries are present. */
  desktopDownloadsEnabled: boolean;
  /** Desktop handoff signing key presence. */
  desktopHandoffSigningKeySet: boolean;
  /** Optional dedicated audit signing key — falls back to NEXTAUTH_SECRET if unset. */
  auditSigningKeySet: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return fallback;
}

function mode(value: string | undefined, fallback: FeatureMode): FeatureMode {
  if (value === undefined) return fallback;
  const v = value.trim().toLowerCase();
  if (v === "live" || v === "preview" || v === "disabled") return v;
  return fallback;
}

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Loader (memoised — env doesn't change at runtime)
// ---------------------------------------------------------------------------

let _cached: AppEnv | null = null;

export function loadAppEnv(): AppEnv {
  if (_cached) return _cached;
  const env = process.env;

  const appUrl =
    env.APP_URL?.trim() ||
    env.NEXTAUTH_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  _cached = {
    appUrl,
    nextAuthSecret: env.NEXTAUTH_SECRET?.trim(),
    nextAuthUrl: env.NEXTAUTH_URL?.trim(),
    databaseUrlSet: isSet(env.DATABASE_URL),
    aiProviders: {
      openai:    isSet(env.OPENAI_API_KEY),
      anthropic: isSet(env.ANTHROPIC_API_KEY),
      gemini:    isSet(env.GEMINI_API_KEY),
    },
    oauth: {
      google: isSet(env.GOOGLE_CLIENT_ID) && isSet(env.GOOGLE_CLIENT_SECRET),
      github: isSet(env.GITHUB_CLIENT_ID) && isSet(env.GITHUB_CLIENT_SECRET),
    },
    awsBrokerConfigured:
      isSet(env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID) &&
      isSet(env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY),
    awsScanMode: mode(
      env.AWS_SCAN_MODE,
      isSet(env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID) ? "live" : "preview",
    ),
    awsBrokerAccessKeyId:     env.AWS_CONNECTOR_BROKER_ACCESS_KEY_ID?.trim() || undefined,
    awsBrokerSecretAccessKey: env.AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY?.trim() || undefined,
    awsAmbientRoleArn:        env.AWS_ROLE_ARN?.trim() || undefined,
    awsAmbientExternalId:     env.AWS_EXTERNAL_ID?.trim() || undefined,
    awsAmbientRegion:         env.AWS_REGION?.trim() || undefined,
    awsCostExplorerEnabled:   bool(env.AWS_COST_EXPLORER_ENABLED, false),
    awsUseDirectCreds:        bool(env.AWS_USE_DIRECT_CREDS, false),
    azureCostMgmtEnabled:     bool(env.AZURE_COST_MGMT_ENABLED, false),
    telemetryWebhookSecret:   env.TELEMETRY_WEBHOOK_SECRET?.trim() || undefined,
    incidentWebhookSecret:    env.INCIDENT_WEBHOOK_SECRET?.trim() || undefined,
    autonomySchedulerEnabled: bool(env.AUTONOMY_SCHEDULER_ENABLED, false),
    cronSecret:               env.CRON_SECRET?.trim() || undefined,
    awsEcsExtractEnabled:     bool(env.AWS_ECS_EXTRACT_ENABLED, false),
    awsEksExtractEnabled:     bool(env.AWS_EKS_EXTRACT_ENABLED, false),
    githubActionsExtractEnabled: bool(env.GITHUB_ACTIONS_EXTRACT_ENABLED, false),
    awsCloudWatchPullEnabled:  bool(env.AWS_CLOUDWATCH_PULL_ENABLED, false),
    awsInventoryExtractEnabled: bool(env.AWS_INVENTORY_EXTRACT_ENABLED, false),
    pagerDutyPullEnabled:      bool(env.PAGERDUTY_PULL_ENABLED, false),
    pagerDutyApiToken:         env.PAGERDUTY_API_TOKEN?.trim() || undefined,
    datadogPullEnabled:        bool(env.DATADOG_PULL_ENABLED, false),
    datadogApiKey:             env.DATADOG_API_KEY?.trim() || undefined,
    datadogAppKey:             env.DATADOG_APPLICATION_KEY?.trim() || undefined,
    datadogSite:               env.DATADOG_SITE?.trim() || undefined,
    sentryPullEnabled:         bool(env.SENTRY_PULL_ENABLED, false),
    sentryAuthToken:           env.SENTRY_AUTH_TOKEN?.trim() || undefined,
    sentryOrg:                 env.SENTRY_ORG?.trim() || undefined,
    sentryBaseUrl:             env.SENTRY_BASE_URL?.trim() || undefined,
    ghcrExtractEnabled:        bool(env.GHCR_EXTRACT_ENABLED, false),
    ghcrOrg:                   env.GHCR_ORG?.trim() || undefined,
    ghcrDeepInspect:           bool(env.GHCR_DEEP_INSPECT, false),
    slackWebhookUrl:           env.SLACK_WEBHOOK_URL?.trim() || undefined,
    teamsWebhookUrl:           env.TEAMS_WEBHOOK_URL?.trim() || undefined,
    outboundWebhookUrl:        env.OUTBOUND_WEBHOOK_URL?.trim() || undefined,
    outboundWebhookSecret:     env.OUTBOUND_WEBHOOK_SECRET?.trim() || undefined,
    azureInventoryExtractEnabled: bool(env.AZURE_INVENTORY_EXTRACT_ENABLED, false),
    gcpInventoryExtractEnabled:   bool(env.GCP_INVENTORY_EXTRACT_ENABLED, false),
    githubDeepPostureEnabled:     bool(env.GITHUB_DEEP_POSTURE_ENABLED, false),
    vercelDeploymentsEnabled:     bool(env.VERCEL_DEPLOYMENTS_EXTRACT_ENABLED, false),
    vercelToken:                  env.VERCEL_TOKEN?.trim() || undefined,
    vercelProjectId:              env.VERCEL_PROJECT_ID?.trim() || undefined,
    vercelTeamId:                 env.VERCEL_TEAM_ID?.trim() || undefined,
    azureConfigured:
      isSet(env.AZURE_TENANT_ID) &&
      isSet(env.AZURE_CLIENT_ID) &&
      isSet(env.AZURE_CLIENT_SECRET) &&
      isSet(env.AZURE_SUBSCRIPTION_ID),
    azureScanMode: mode(
      env.AZURE_SCAN_MODE,
      isSet(env.AZURE_CLIENT_SECRET) ? "live" : "preview",
    ),
    azureSubscriptionId: env.AZURE_SUBSCRIPTION_ID?.trim() || undefined,
    azureTenantId: env.AZURE_TENANT_ID?.trim() || undefined,
    gcpConfigured:
      (isSet(env.GCP_PROJECT_ID) && isSet(env.GCP_CLIENT_EMAIL) && isSet(env.GCP_PRIVATE_KEY)) ||
      (isSet(env.GCP_PROJECT_ID) && isSet(env.GCP_SERVICE_ACCOUNT_JSON)),
    gcpScanMode: mode(
      env.GCP_SCAN_MODE,
      (isSet(env.GCP_PRIVATE_KEY) || isSet(env.GCP_SERVICE_ACCOUNT_JSON)) ? "live" : "preview",
    ),
    gcpProjectId: env.GCP_PROJECT_ID?.trim() || undefined,
    githubSyncMode: mode(
      env.GITHUB_SYNC_MODE,
      isSet(env.GITHUB_PAT) || isSet(env.GITHUB_APP_ID) ? "live" : "preview",
    ),
    githubPatConfigured: isSet(env.GITHUB_PAT),
    githubAppConfigured: isSet(env.GITHUB_APP_ID) && isSet(env.GITHUB_PRIVATE_KEY),
    githubDefaultOrg: env.GITHUB_DEFAULT_ORG?.trim() || undefined,
    desktopMode: mode(env.DESKTOP_MODE, "preview"),
    desktopDownloadsEnabled: bool(env.DESKTOP_DOWNLOADS_ENABLED, false),
    desktopHandoffSigningKeySet: isSet(env.DESKTOP_HANDOFF_SIGNING_KEY),
    auditSigningKeySet: isSet(env.AUDIT_SIGNING_KEY),
  };
  return _cached;
}

/** Force a reload — test seam. */
export function __resetEnvCacheForTest(): void { _cached = null; }

// ---------------------------------------------------------------------------
// Required-var assertions
// ---------------------------------------------------------------------------

export function assertCoreEnv(): void {
  const env = loadAppEnv();
  const missing: string[] = [];
  if (!env.nextAuthSecret) missing.push("NEXTAUTH_SECRET");
  if (!env.databaseUrlSet) missing.push("DATABASE_URL");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}.`);
  }
}
