/**
 * Axiom Agent — Multi-Tenant API Gateway
 *
 * Enterprise SaaS layer enabling Axiom to serve multiple organizations
 * with tenant isolation, rate limiting, API authentication, usage
 * metering, and quota management.
 *
 * This is the boundary between Axiom's internal intelligence and the
 * outside world — every external request passes through here.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Gateway Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type APIVersion = "v1" | "v2";

export type AuthMethod = "api_key" | "oauth2" | "jwt" | "session" | "service_account";

export type TenantTier = "free" | "starter" | "professional" | "enterprise" | "custom";

export type RequestStatus = "accepted" | "rejected" | "rate_limited" | "unauthorized" | "forbidden" | "error";

export interface APIRequest {
  requestId: string;
  tenantId: string;
  userId?: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  version: APIVersion;
  authMethod: AuthMethod;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  durationMs?: number;
  status: RequestStatus;
  statusCode: number;
  responseSize?: number;
}

export interface TenantContext {
  tenantId: string;
  organizationName: string;
  tier: TenantTier;
  active: boolean;
  createdAt: string;
  quotas: TenantQuotas;
  features: TenantFeatureFlags;
  cloudAccounts: TenantCloudAccount[];
  apiKeys: TenantAPIKey[];
  slaLevel: string;
}

export interface TenantCloudAccount {
  accountId: string;
  provider: "aws" | "azure" | "gcp";
  alias: string;
  credentialRef: string;
  enabled: boolean;
  regions: string[];
}

export interface TenantAPIKey {
  keyId: string;
  name: string;
  prefix: string;
  scopes: APIScope[];
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
  active: boolean;
  rateLimit?: number;
}

export type APIScope =
  | "read:posture"
  | "read:findings"
  | "read:recommendations"
  | "read:costs"
  | "read:compliance"
  | "read:incidents"
  | "read:events"
  | "write:execute"
  | "write:approve"
  | "write:configure"
  | "write:notifications"
  | "admin:tenant"
  | "admin:users"
  | "admin:billing";

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Rate Limiting & Quotas
// ═══════════════════════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstLimit: number;
  strategy: "sliding_window" | "token_bucket" | "fixed_window";
  keyBy: "tenant" | "user" | "api_key" | "ip";
  excludePaths: string[];
}

export interface TenantQuotas {
  maxCloudAccounts: number;
  maxUsersPerOrg: number;
  maxAPICallsPerDay: number;
  maxAPICallsPerMinute: number;
  maxAgentRunsPerDay: number;
  maxConcurrentRuns: number;
  retentionDays: number;
  maxWebhooks: number;
  maxAlertRules: number;
  customIntegrationsAllowed: boolean;
}

export const TIER_QUOTAS: Record<TenantTier, TenantQuotas> = {
  free: {
    maxCloudAccounts: 1,
    maxUsersPerOrg: 2,
    maxAPICallsPerDay: 1_000,
    maxAPICallsPerMinute: 10,
    maxAgentRunsPerDay: 5,
    maxConcurrentRuns: 1,
    retentionDays: 7,
    maxWebhooks: 1,
    maxAlertRules: 5,
    customIntegrationsAllowed: false,
  },
  starter: {
    maxCloudAccounts: 3,
    maxUsersPerOrg: 10,
    maxAPICallsPerDay: 10_000,
    maxAPICallsPerMinute: 50,
    maxAgentRunsPerDay: 25,
    maxConcurrentRuns: 2,
    retentionDays: 30,
    maxWebhooks: 5,
    maxAlertRules: 25,
    customIntegrationsAllowed: false,
  },
  professional: {
    maxCloudAccounts: 10,
    maxUsersPerOrg: 50,
    maxAPICallsPerDay: 100_000,
    maxAPICallsPerMinute: 200,
    maxAgentRunsPerDay: 100,
    maxConcurrentRuns: 5,
    retentionDays: 90,
    maxWebhooks: 20,
    maxAlertRules: 100,
    customIntegrationsAllowed: true,
  },
  enterprise: {
    maxCloudAccounts: 100,
    maxUsersPerOrg: 500,
    maxAPICallsPerDay: 1_000_000,
    maxAPICallsPerMinute: 1_000,
    maxAgentRunsPerDay: 1_000,
    maxConcurrentRuns: 20,
    retentionDays: 365,
    maxWebhooks: 100,
    maxAlertRules: 500,
    customIntegrationsAllowed: true,
  },
  custom: {
    maxCloudAccounts: -1,
    maxUsersPerOrg: -1,
    maxAPICallsPerDay: -1,
    maxAPICallsPerMinute: -1,
    maxAgentRunsPerDay: -1,
    maxConcurrentRuns: -1,
    retentionDays: -1,
    maxWebhooks: -1,
    maxAlertRules: -1,
    customIntegrationsAllowed: true,
  },
};

export const RATE_LIMIT_CONFIGS: Record<TenantTier, RateLimitConfig> = {
  free: { windowMs: 60_000, maxRequests: 10, burstLimit: 15, strategy: "sliding_window", keyBy: "tenant", excludePaths: ["/health", "/status"] },
  starter: { windowMs: 60_000, maxRequests: 50, burstLimit: 75, strategy: "sliding_window", keyBy: "tenant", excludePaths: ["/health", "/status"] },
  professional: { windowMs: 60_000, maxRequests: 200, burstLimit: 300, strategy: "token_bucket", keyBy: "api_key", excludePaths: ["/health", "/status"] },
  enterprise: { windowMs: 60_000, maxRequests: 1_000, burstLimit: 1_500, strategy: "token_bucket", keyBy: "api_key", excludePaths: ["/health", "/status"] },
  custom: { windowMs: 60_000, maxRequests: 5_000, burstLimit: 7_500, strategy: "token_bucket", keyBy: "api_key", excludePaths: ["/health", "/status"] },
};

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Feature Flags & Tier Capabilities
// ═══════════════════════════════════════════════════════════════════════════════

export interface TenantFeatureFlags {
  autoRemediation: boolean;
  predictiveScaling: boolean;
  complianceReporting: boolean;
  customPolicies: boolean;
  multiCloudSupport: boolean;
  advancedAnalytics: boolean;
  terraformGeneration: boolean;
  incidentManagement: boolean;
  ssoIntegration: boolean;
  auditExport: boolean;
  customDashboards: boolean;
  apiWebhooks: boolean;
  slackIntegration: boolean;
  pagerDutyIntegration: boolean;
  jiraIntegration: boolean;
  dataExport: boolean;
}

export const TIER_FEATURES: Record<TenantTier, TenantFeatureFlags> = {
  free: {
    autoRemediation: false, predictiveScaling: false, complianceReporting: false,
    customPolicies: false, multiCloudSupport: false, advancedAnalytics: false,
    terraformGeneration: false, incidentManagement: false, ssoIntegration: false,
    auditExport: false, customDashboards: false, apiWebhooks: false,
    slackIntegration: false, pagerDutyIntegration: false, jiraIntegration: false,
    dataExport: false,
  },
  starter: {
    autoRemediation: false, predictiveScaling: false, complianceReporting: true,
    customPolicies: false, multiCloudSupport: false, advancedAnalytics: false,
    terraformGeneration: true, incidentManagement: false, ssoIntegration: false,
    auditExport: false, customDashboards: false, apiWebhooks: true,
    slackIntegration: true, pagerDutyIntegration: false, jiraIntegration: false,
    dataExport: false,
  },
  professional: {
    autoRemediation: true, predictiveScaling: true, complianceReporting: true,
    customPolicies: true, multiCloudSupport: true, advancedAnalytics: true,
    terraformGeneration: true, incidentManagement: true, ssoIntegration: false,
    auditExport: true, customDashboards: true, apiWebhooks: true,
    slackIntegration: true, pagerDutyIntegration: true, jiraIntegration: true,
    dataExport: true,
  },
  enterprise: {
    autoRemediation: true, predictiveScaling: true, complianceReporting: true,
    customPolicies: true, multiCloudSupport: true, advancedAnalytics: true,
    terraformGeneration: true, incidentManagement: true, ssoIntegration: true,
    auditExport: true, customDashboards: true, apiWebhooks: true,
    slackIntegration: true, pagerDutyIntegration: true, jiraIntegration: true,
    dataExport: true,
  },
  custom: {
    autoRemediation: true, predictiveScaling: true, complianceReporting: true,
    customPolicies: true, multiCloudSupport: true, advancedAnalytics: true,
    terraformGeneration: true, incidentManagement: true, ssoIntegration: true,
    auditExport: true, customDashboards: true, apiWebhooks: true,
    slackIntegration: true, pagerDutyIntegration: true, jiraIntegration: true,
    dataExport: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — API Endpoint Registry
// ═══════════════════════════════════════════════════════════════════════════════

export interface APIEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  version: APIVersion;
  requiredScopes: APIScope[];
  minimumTier: TenantTier;
  rateWeight: number;
  cacheTTLSeconds?: number;
  description: string;
}

export const API_ENDPOINTS: APIEndpoint[] = [
  // ── Posture & Overview ──
  { id: "get-posture", method: "GET", path: "/posture", version: "v1", requiredScopes: ["read:posture"], minimumTier: "free", rateWeight: 1, cacheTTLSeconds: 60, description: "Get overall security and operational posture score" },
  { id: "get-posture-history", method: "GET", path: "/posture/history", version: "v1", requiredScopes: ["read:posture"], minimumTier: "starter", rateWeight: 2, cacheTTLSeconds: 300, description: "Get historical posture scores and trend" },
  { id: "get-dashboard", method: "GET", path: "/dashboard", version: "v1", requiredScopes: ["read:posture"], minimumTier: "free", rateWeight: 3, cacheTTLSeconds: 30, description: "Get dashboard overview with key metrics" },

  // ── Findings & Recommendations ──
  { id: "list-findings", method: "GET", path: "/findings", version: "v1", requiredScopes: ["read:findings"], minimumTier: "free", rateWeight: 2, cacheTTLSeconds: 30, description: "List security and operational findings" },
  { id: "get-finding", method: "GET", path: "/findings/:id", version: "v1", requiredScopes: ["read:findings"], minimumTier: "free", rateWeight: 1, cacheTTLSeconds: 30, description: "Get details for a specific finding" },
  { id: "list-recommendations", method: "GET", path: "/recommendations", version: "v1", requiredScopes: ["read:recommendations"], minimumTier: "free", rateWeight: 2, cacheTTLSeconds: 60, description: "List prioritized recommendations" },
  { id: "accept-recommendation", method: "POST", path: "/recommendations/:id/accept", version: "v1", requiredScopes: ["write:execute"], minimumTier: "starter", rateWeight: 5, description: "Accept and execute a recommendation" },

  // ── Costs ──
  { id: "get-cost-summary", method: "GET", path: "/costs/summary", version: "v1", requiredScopes: ["read:costs"], minimumTier: "starter", rateWeight: 2, cacheTTLSeconds: 300, description: "Get cost summary with breakdown and trends" },
  { id: "get-cost-anomalies", method: "GET", path: "/costs/anomalies", version: "v1", requiredScopes: ["read:costs"], minimumTier: "professional", rateWeight: 2, cacheTTLSeconds: 60, description: "List detected cost anomalies" },
  { id: "get-cost-forecast", method: "GET", path: "/costs/forecast", version: "v1", requiredScopes: ["read:costs"], minimumTier: "professional", rateWeight: 3, cacheTTLSeconds: 3600, description: "Get cost forecast for upcoming periods" },

  // ── Compliance ──
  { id: "get-compliance-summary", method: "GET", path: "/compliance/summary", version: "v1", requiredScopes: ["read:compliance"], minimumTier: "starter", rateWeight: 2, cacheTTLSeconds: 300, description: "Get compliance posture across frameworks" },
  { id: "get-compliance-framework", method: "GET", path: "/compliance/:framework", version: "v1", requiredScopes: ["read:compliance"], minimumTier: "starter", rateWeight: 2, cacheTTLSeconds: 300, description: "Get detailed compliance status for a specific framework" },
  { id: "export-compliance-report", method: "POST", path: "/compliance/export", version: "v1", requiredScopes: ["read:compliance"], minimumTier: "professional", rateWeight: 10, description: "Generate and export compliance report" },

  // ── Incidents ──
  { id: "list-incidents", method: "GET", path: "/incidents", version: "v1", requiredScopes: ["read:incidents"], minimumTier: "professional", rateWeight: 2, cacheTTLSeconds: 10, description: "List active and recent incidents" },
  { id: "get-incident", method: "GET", path: "/incidents/:id", version: "v1", requiredScopes: ["read:incidents"], minimumTier: "professional", rateWeight: 1, cacheTTLSeconds: 10, description: "Get incident details with timeline" },
  { id: "acknowledge-incident", method: "POST", path: "/incidents/:id/acknowledge", version: "v1", requiredScopes: ["write:execute"], minimumTier: "professional", rateWeight: 3, description: "Acknowledge an incident" },

  // ── Events & Signals ──
  { id: "list-events", method: "GET", path: "/events", version: "v1", requiredScopes: ["read:events"], minimumTier: "starter", rateWeight: 2, cacheTTLSeconds: 10, description: "List recent cloud events" },
  { id: "list-signals", method: "GET", path: "/signals", version: "v1", requiredScopes: ["read:events"], minimumTier: "starter", rateWeight: 2, cacheTTLSeconds: 10, description: "List detected signals" },

  // ── Execution ──
  { id: "trigger-scan", method: "POST", path: "/scans", version: "v1", requiredScopes: ["write:execute"], minimumTier: "free", rateWeight: 10, description: "Trigger an on-demand infrastructure scan" },
  { id: "list-runs", method: "GET", path: "/runs", version: "v1", requiredScopes: ["read:posture"], minimumTier: "free", rateWeight: 2, cacheTTLSeconds: 30, description: "List agent run history" },
  { id: "get-run", method: "GET", path: "/runs/:id", version: "v1", requiredScopes: ["read:posture"], minimumTier: "free", rateWeight: 1, cacheTTLSeconds: 30, description: "Get details for a specific agent run" },
  { id: "approve-action", method: "POST", path: "/actions/:id/approve", version: "v1", requiredScopes: ["write:approve"], minimumTier: "starter", rateWeight: 5, description: "Approve a pending execution action" },

  // ── Configuration ──
  { id: "get-config", method: "GET", path: "/config", version: "v1", requiredScopes: ["admin:tenant"], minimumTier: "free", rateWeight: 1, cacheTTLSeconds: 60, description: "Get tenant configuration" },
  { id: "update-config", method: "PATCH", path: "/config", version: "v1", requiredScopes: ["write:configure"], minimumTier: "starter", rateWeight: 3, description: "Update tenant configuration" },
  { id: "list-cloud-accounts", method: "GET", path: "/accounts", version: "v1", requiredScopes: ["admin:tenant"], minimumTier: "free", rateWeight: 1, cacheTTLSeconds: 60, description: "List connected cloud accounts" },
  { id: "add-cloud-account", method: "POST", path: "/accounts", version: "v1", requiredScopes: ["admin:tenant"], minimumTier: "free", rateWeight: 5, description: "Connect a new cloud account" },

  // ── Webhooks ──
  { id: "list-webhooks", method: "GET", path: "/webhooks", version: "v1", requiredScopes: ["write:notifications"], minimumTier: "starter", rateWeight: 1, cacheTTLSeconds: 60, description: "List configured webhooks" },
  { id: "create-webhook", method: "POST", path: "/webhooks", version: "v1", requiredScopes: ["write:notifications"], minimumTier: "starter", rateWeight: 3, description: "Create a new webhook endpoint" },

  // ── Usage & Billing ──
  { id: "get-usage", method: "GET", path: "/usage", version: "v1", requiredScopes: ["admin:billing"], minimumTier: "free", rateWeight: 1, cacheTTLSeconds: 300, description: "Get current usage against quotas" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Tenant Isolation & Data Boundaries
// ═══════════════════════════════════════════════════════════════════════════════

export interface TenantIsolationPolicy {
  dataIsolation: "logical" | "schema" | "database";
  encryptionScope: "shared_key" | "tenant_key" | "customer_managed_key";
  networkIsolation: boolean;
  computeIsolation: boolean;
  cacheIsolation: boolean;
  logIsolation: boolean;
  backupIsolation: boolean;
}

export const TIER_ISOLATION: Record<TenantTier, TenantIsolationPolicy> = {
  free: { dataIsolation: "logical", encryptionScope: "shared_key", networkIsolation: false, computeIsolation: false, cacheIsolation: false, logIsolation: false, backupIsolation: false },
  starter: { dataIsolation: "logical", encryptionScope: "shared_key", networkIsolation: false, computeIsolation: false, cacheIsolation: false, logIsolation: true, backupIsolation: false },
  professional: { dataIsolation: "schema", encryptionScope: "tenant_key", networkIsolation: false, computeIsolation: false, cacheIsolation: true, logIsolation: true, backupIsolation: true },
  enterprise: { dataIsolation: "database", encryptionScope: "customer_managed_key", networkIsolation: true, computeIsolation: true, cacheIsolation: true, logIsolation: true, backupIsolation: true },
  custom: { dataIsolation: "database", encryptionScope: "customer_managed_key", networkIsolation: true, computeIsolation: true, cacheIsolation: true, logIsolation: true, backupIsolation: true },
};

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Usage Metering
// ═══════════════════════════════════════════════════════════════════════════════

export type UsageMetricType =
  | "api_calls"
  | "agent_runs"
  | "cloud_accounts"
  | "users"
  | "storage_gb"
  | "events_processed"
  | "findings_generated"
  | "terraform_plans"
  | "notifications_sent"
  | "compliance_scans";

export interface UsageMeter {
  tenantId: string;
  metricType: UsageMetricType;
  periodStart: string;
  periodEnd: string;
  currentValue: number;
  limitValue: number;
  utilizationPercent: number;
  overageAllowed: boolean;
  overageRatePerUnit?: number;
}

export interface UsageSnapshot {
  tenantId: string;
  timestamp: string;
  period: "hourly" | "daily" | "monthly";
  meters: UsageMeter[];
  estimatedCost: number;
  quotaUtilization: Record<UsageMetricType, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Gateway Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type GatewayPipelineStageId =
  | "receive"
  | "authenticate"
  | "identify_tenant"
  | "check_rate_limit"
  | "check_quota"
  | "authorize_scope"
  | "validate_input"
  | "route"
  | "execute"
  | "meter_usage"
  | "respond";

export interface GatewayPipelineStage {
  id: GatewayPipelineStageId;
  name: string;
  order: number;
  timeoutMs: number;
  failAction: "reject" | "fallback" | "pass_through";
  metricsKey: string;
  description: string;
}

export const GATEWAY_PIPELINE: GatewayPipelineStage[] = [
  { id: "receive", name: "Receive", order: 1, timeoutMs: 1_000, failAction: "reject", metricsKey: "gateway.receive", description: "Accept incoming HTTP request" },
  { id: "authenticate", name: "Authenticate", order: 2, timeoutMs: 2_000, failAction: "reject", metricsKey: "gateway.auth", description: "Validate API key, JWT, or OAuth token" },
  { id: "identify_tenant", name: "Identify Tenant", order: 3, timeoutMs: 500, failAction: "reject", metricsKey: "gateway.tenant", description: "Resolve tenant from auth context" },
  { id: "check_rate_limit", name: "Check Rate Limit", order: 4, timeoutMs: 100, failAction: "reject", metricsKey: "gateway.rate_limit", description: "Enforce per-tenant/key rate limits" },
  { id: "check_quota", name: "Check Quota", order: 5, timeoutMs: 100, failAction: "reject", metricsKey: "gateway.quota", description: "Verify request against daily/monthly quotas" },
  { id: "authorize_scope", name: "Authorize Scope", order: 6, timeoutMs: 100, failAction: "reject", metricsKey: "gateway.scope", description: "Verify API key scopes against endpoint requirements" },
  { id: "validate_input", name: "Validate Input", order: 7, timeoutMs: 500, failAction: "reject", metricsKey: "gateway.validate", description: "Validate request body and parameters" },
  { id: "route", name: "Route", order: 8, timeoutMs: 100, failAction: "reject", metricsKey: "gateway.route", description: "Match endpoint and resolve handler" },
  { id: "execute", name: "Execute", order: 9, timeoutMs: 30_000, failAction: "fallback", metricsKey: "gateway.execute", description: "Execute endpoint handler with tenant context" },
  { id: "meter_usage", name: "Meter Usage", order: 10, timeoutMs: 100, failAction: "pass_through", metricsKey: "gateway.meter", description: "Record usage for billing and quota tracking" },
  { id: "respond", name: "Respond", order: 11, timeoutMs: 500, failAction: "reject", metricsKey: "gateway.respond", description: "Send response with appropriate headers and status" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type GatewayIntegrationTarget =
  | "cognitive_loop"
  | "security_intelligence"
  | "cost_intelligence"
  | "compliance_engine"
  | "incident_response"
  | "signal_detection"
  | "notification_engine"
  | "audit_trail"
  | "cloud_event_stream"
  | "execution_safety";

export interface GatewayIntegrationContract {
  target: GatewayIntegrationTarget;
  direction: "inbound" | "outbound" | "bidirectional";
  protocol: "function_call" | "event_bus" | "rest_api";
  dataShape: string;
  slaMs: number;
  description: string;
}

export const GATEWAY_INTEGRATION_CONTRACTS: GatewayIntegrationContract[] = [
  { target: "cognitive_loop", direction: "outbound", protocol: "function_call", dataShape: "APIRequest → CognitiveInput", slaMs: 5_000, description: "Routes scan triggers and action requests to the cognitive loop" },
  { target: "security_intelligence", direction: "outbound", protocol: "function_call", dataShape: "PostureQuery → SecurityPosture", slaMs: 2_000, description: "Reads security posture and findings for API responses" },
  { target: "cost_intelligence", direction: "outbound", protocol: "function_call", dataShape: "CostQuery → CostSummary", slaMs: 2_000, description: "Reads cost data and forecasts for API responses" },
  { target: "compliance_engine", direction: "outbound", protocol: "function_call", dataShape: "ComplianceQuery → ComplianceReport", slaMs: 3_000, description: "Reads compliance status and generates reports" },
  { target: "incident_response", direction: "outbound", protocol: "function_call", dataShape: "IncidentQuery → IncidentList", slaMs: 1_000, description: "Reads and manages incidents via API" },
  { target: "signal_detection", direction: "outbound", protocol: "function_call", dataShape: "SignalQuery → SignalList", slaMs: 1_000, description: "Reads signals and events for API responses" },
  { target: "notification_engine", direction: "outbound", protocol: "function_call", dataShape: "WebhookConfig → NotificationSetup", slaMs: 500, description: "Manages webhook and notification configurations" },
  { target: "audit_trail", direction: "outbound", protocol: "function_call", dataShape: "APIRequest → AuditEntry", slaMs: 100, description: "All API requests are logged to the audit trail" },
  { target: "cloud_event_stream", direction: "inbound", protocol: "rest_api", dataShape: "WebhookPayload → CloudEvent", slaMs: 5_000, description: "Receives webhook callbacks from cloud providers" },
  { target: "execution_safety", direction: "outbound", protocol: "function_call", dataShape: "ExecuteAction → SafetyValidation", slaMs: 2_000, description: "Validates execution requests before forwarding to the engine" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getTierQuotas(tier: TenantTier): TenantQuotas {
  return TIER_QUOTAS[tier];
}

export function getTierFeatures(tier: TenantTier): TenantFeatureFlags {
  return TIER_FEATURES[tier];
}

export function getTierRateLimit(tier: TenantTier): RateLimitConfig {
  return RATE_LIMIT_CONFIGS[tier];
}

export function getTierIsolation(tier: TenantTier): TenantIsolationPolicy {
  return TIER_ISOLATION[tier];
}

export function getAPIEndpoint(id: string): APIEndpoint | undefined {
  return API_ENDPOINTS.find(e => e.id === id);
}

export function getEndpointsByMethod(method: APIEndpoint["method"]): APIEndpoint[] {
  return API_ENDPOINTS.filter(e => e.method === method);
}

export function getEndpointsRequiringScope(scope: APIScope): APIEndpoint[] {
  return API_ENDPOINTS.filter(e => e.requiredScopes.includes(scope));
}

export function getEndpointsForTier(tier: TenantTier): APIEndpoint[] {
  const tierOrder: TenantTier[] = ["free", "starter", "professional", "enterprise", "custom"];
  const tierIndex = tierOrder.indexOf(tier);
  return API_ENDPOINTS.filter(e => tierOrder.indexOf(e.minimumTier) <= tierIndex);
}

export function getCacheableEndpoints(): APIEndpoint[] {
  return API_ENDPOINTS.filter(e => e.cacheTTLSeconds !== undefined && e.cacheTTLSeconds > 0);
}

export function getGatewayPipelineStage(id: GatewayPipelineStageId): GatewayPipelineStage | undefined {
  return GATEWAY_PIPELINE.find(s => s.id === id);
}

export function getGatewayPipelineOrder(): GatewayPipelineStageId[] {
  return [...GATEWAY_PIPELINE].sort((a, b) => a.order - b.order).map(s => s.id);
}

export function getGatewayIntegration(target: GatewayIntegrationTarget): GatewayIntegrationContract | undefined {
  return GATEWAY_INTEGRATION_CONTRACTS.find(c => c.target === target);
}

export function isFeatureEnabled(features: TenantFeatureFlags, feature: keyof TenantFeatureFlags): boolean {
  return features[feature];
}

export function isWithinQuota(currentUsage: number, quotaLimit: number): boolean {
  if (quotaLimit < 0) return true;
  return currentUsage < quotaLimit;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface APIGatewayTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runAPIGatewayTests(): APIGatewayTestResult[] {
  const results: APIGatewayTestResult[] = [];
  const assert = (name: string, condition: boolean, detail: string) =>
    results.push({ name, passed: condition, detail });

  // §1 — Tier Quotas
  assert("All 5 tiers have quotas", Object.keys(TIER_QUOTAS).length === 5, "All tiers defined");
  assert("Free tier limited to 1 account", getTierQuotas("free").maxCloudAccounts === 1, "Free = 1 account");
  assert("Enterprise allows 100 accounts", getTierQuotas("enterprise").maxCloudAccounts === 100, "Enterprise = 100");
  assert("Custom tier unlimited (-1)", getTierQuotas("custom").maxCloudAccounts === -1, "Custom = unlimited");
  assert("Tiers scale in API limits", getTierQuotas("free").maxAPICallsPerDay < getTierQuotas("starter").maxAPICallsPerDay, "Limits scale");

  // §2 — Rate Limits
  assert("All tiers have rate limits", Object.keys(RATE_LIMIT_CONFIGS).length === 5, "Rate limits defined");
  assert("Free rate = 10/min", getTierRateLimit("free").maxRequests === 10, "Free rate limited");
  assert("Enterprise rate = 1000/min", getTierRateLimit("enterprise").maxRequests === 1_000, "Enterprise high rate");

  // §3 — Feature Flags
  assert("Free tier minimal features", !getTierFeatures("free").autoRemediation, "No auto-remediation on free");
  assert("Professional has auto-remediation", getTierFeatures("professional").autoRemediation, "Pro has auto-remediation");
  assert("Enterprise has SSO", getTierFeatures("enterprise").ssoIntegration, "Enterprise SSO");
  assert("Free has no Slack", !getTierFeatures("free").slackIntegration, "No Slack on free");

  // §4 — API Endpoints
  assert("API endpoints defined", API_ENDPOINTS.length >= 28, `Found ${API_ENDPOINTS.length} endpoints`);
  assert("Free tier endpoints", getEndpointsForTier("free").length >= 10, "Free has core endpoints");
  assert("Enterprise gets all", getEndpointsForTier("enterprise").length === API_ENDPOINTS.length, "Enterprise = all");
  assert("Cacheable endpoints exist", getCacheableEndpoints().length >= 15, "Cache headers defined");
  assert("GET endpoints", getEndpointsByMethod("GET").length >= 18, "Read endpoints");
  assert("POST endpoints", getEndpointsByMethod("POST").length >= 8, "Write endpoints");

  // §5 — Tenant Isolation
  assert("Free uses logical isolation", getTierIsolation("free").dataIsolation === "logical", "Logical isolation");
  assert("Enterprise uses DB isolation", getTierIsolation("enterprise").dataIsolation === "database", "Full DB isolation");
  assert("Enterprise uses CMK encryption", getTierIsolation("enterprise").encryptionScope === "customer_managed_key", "CMK encryption");

  // §6 — Gateway Pipeline
  assert("Pipeline has 11 stages", GATEWAY_PIPELINE.length === 11, `Found ${GATEWAY_PIPELINE.length} stages`);
  assert("Starts with receive", getGatewayPipelineOrder()[0] === "receive", "Receive first");
  assert("Ends with respond", getGatewayPipelineOrder()[10] === "respond", "Respond last");
  assert("Auth is stage 2", getGatewayPipelineStage("authenticate")?.order === 2, "Auth early");

  // §7 — Integration Contracts
  assert("10 integration contracts", GATEWAY_INTEGRATION_CONTRACTS.length === 10, `Found ${GATEWAY_INTEGRATION_CONTRACTS.length}`);
  assert("Audit trail connected", getGatewayIntegration("audit_trail") !== undefined, "Audit connected");

  // §8 — Utility Functions
  assert("Feature flag check works", isFeatureEnabled(getTierFeatures("enterprise"), "ssoIntegration"), "Feature check");
  assert("Within quota works", isWithinQuota(50, 100), "Under quota");
  assert("Over quota works", !isWithinQuota(100, 100), "Over quota");
  assert("Unlimited quota works", isWithinQuota(999_999, -1), "Unlimited");

  return results;
}
