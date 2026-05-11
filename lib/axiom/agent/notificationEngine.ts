// ─────────────────────────────────────────────────────────────────────────────
// Notification & Communication Engine
// Multi-channel notification delivery with templates, routing, escalation,
// digest aggregation, and preference-aware delivery — the human interface
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Notification Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationChannel =
  | "slack"
  | "email"
  | "pagerduty"
  | "sms"
  | "webhook"
  | "microsoft_teams"
  | "in_app"
  | "opsgenie";

export type NotificationPriority = "critical" | "high" | "medium" | "low" | "informational";

export type NotificationCategory =
  | "incident"
  | "signal"
  | "execution"
  | "approval_request"
  | "approval_decision"
  | "compliance"
  | "cost"
  | "security"
  | "drift"
  | "scheduled"
  | "system"
  | "digest";

export type NotificationStatus = "queued" | "sending" | "delivered" | "failed" | "bounced" | "suppressed" | "acknowledged";

export interface Notification {
  id: string;
  orgId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channel: NotificationChannel;
  templateId: string;
  recipientId: string;
  recipientType: "user" | "team" | "role" | "channel";
  subject: string;
  body: string;
  structuredData: Record<string, unknown>;
  actionButtons: NotificationAction[];
  status: NotificationStatus;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  failureReason: string | null;
  retryCount: number;
  expiresAt: string | null;
  sourceEvent: NotificationSourceEvent;
  metadata: Record<string, unknown>;
}

export interface NotificationAction {
  id: string;
  label: string;
  actionType: "approve" | "reject" | "acknowledge" | "snooze" | "escalate" | "view_details" | "custom";
  url: string | null;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export interface NotificationSourceEvent {
  type: "incident" | "signal" | "execution" | "approval" | "compliance" | "cost" | "system";
  sourceId: string;
  sourceModule: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Notification Templates
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  subjectTemplate: string;
  bodyTemplate: string;
  variables: TemplateVariable[];
  actionButtons: NotificationAction[];
  priority: NotificationPriority;
}

export interface TemplateVariable {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "list" | "object";
  required: boolean;
  defaultValue: unknown;
  description: string;
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // Incident templates
  {
    id: "incident-sev1-created",
    name: "SEV1 Incident Created",
    category: "incident",
    channel: "slack",
    subjectTemplate: "🔴 SEV1: {{title}}",
    bodyTemplate: "**SEV1 Incident Detected**\n\n**Title:** {{title}}\n**Category:** {{category}}\n**Affected Services:** {{affected_services}}\n**Impact:** {{impact_description}}\n**Detection Time:** {{detected_at}}\n\n**Containment Status:** {{containment_status}}\n**Assigned To:** {{assigned_to}}",
    variables: [
      { name: "title", type: "string", required: true, defaultValue: null, description: "Incident title" },
      { name: "category", type: "string", required: true, defaultValue: null, description: "Incident category" },
      { name: "affected_services", type: "string", required: true, defaultValue: null, description: "Affected services" },
      { name: "impact_description", type: "string", required: true, defaultValue: null, description: "Impact description" },
      { name: "detected_at", type: "date", required: true, defaultValue: null, description: "Detection timestamp" },
      { name: "containment_status", type: "string", required: false, defaultValue: "Pending", description: "Containment status" },
      { name: "assigned_to", type: "string", required: false, defaultValue: "Unassigned", description: "Assigned responder" },
    ],
    actionButtons: [
      { id: "ack-incident", label: "Acknowledge", actionType: "acknowledge", url: null, payload: {}, requiresConfirmation: false },
      { id: "view-incident", label: "View Details", actionType: "view_details", url: null, payload: {}, requiresConfirmation: false },
    ],
    priority: "critical",
  },
  {
    id: "incident-resolved",
    name: "Incident Resolved",
    category: "incident",
    channel: "slack",
    subjectTemplate: "✅ Resolved: {{title}}",
    bodyTemplate: "**Incident Resolved**\n\n**Title:** {{title}}\n**Duration:** {{duration_minutes}} minutes\n**Root Cause:** {{root_cause}}\n**Resolution:** {{resolution}}",
    variables: [
      { name: "title", type: "string", required: true, defaultValue: null, description: "Incident title" },
      { name: "duration_minutes", type: "number", required: true, defaultValue: null, description: "Incident duration in minutes" },
      { name: "root_cause", type: "string", required: false, defaultValue: "Under investigation", description: "Root cause summary" },
      { name: "resolution", type: "string", required: true, defaultValue: null, description: "Resolution summary" },
    ],
    actionButtons: [
      { id: "view-pir", label: "View PIR", actionType: "view_details", url: null, payload: {}, requiresConfirmation: false },
    ],
    priority: "medium",
  },
  // Approval templates
  {
    id: "approval-request",
    name: "Approval Request",
    category: "approval_request",
    channel: "slack",
    subjectTemplate: "🔐 Approval Required: {{action_description}}",
    bodyTemplate: "**Approval Request**\n\n**Action:** {{action_description}}\n**Requested By:** {{requested_by}}\n**Resources:** {{resource_count}} resources affected\n**Blast Radius:** {{blast_radius}}\n**Estimated Duration:** {{estimated_duration}}\n**Expires:** {{expires_at}}\n\n**Changeset ID:** `{{changeset_id}}`",
    variables: [
      { name: "action_description", type: "string", required: true, defaultValue: null, description: "Description of the action" },
      { name: "requested_by", type: "string", required: true, defaultValue: null, description: "Requester" },
      { name: "resource_count", type: "number", required: true, defaultValue: null, description: "Number of affected resources" },
      { name: "blast_radius", type: "string", required: true, defaultValue: null, description: "Blast radius assessment" },
      { name: "estimated_duration", type: "string", required: true, defaultValue: null, description: "Estimated duration" },
      { name: "expires_at", type: "date", required: true, defaultValue: null, description: "Approval expiration" },
      { name: "changeset_id", type: "string", required: true, defaultValue: null, description: "Changeset identifier" },
    ],
    actionButtons: [
      { id: "approve", label: "Approve", actionType: "approve", url: null, payload: {}, requiresConfirmation: true },
      { id: "reject", label: "Reject", actionType: "reject", url: null, payload: {}, requiresConfirmation: true },
      { id: "view-changeset", label: "View Changeset", actionType: "view_details", url: null, payload: {}, requiresConfirmation: false },
    ],
    priority: "high",
  },
  // Execution templates
  {
    id: "execution-completed",
    name: "Execution Completed",
    category: "execution",
    channel: "slack",
    subjectTemplate: "{{outcome_emoji}} Execution {{outcome}}: {{description}}",
    bodyTemplate: "**Execution {{outcome}}**\n\n**Description:** {{description}}\n**Resources Changed:** {{resources_changed}}\n**Duration:** {{duration_seconds}}s\n**Provider:** {{provider}} / {{region}}",
    variables: [
      { name: "outcome", type: "string", required: true, defaultValue: null, description: "Execution outcome" },
      { name: "outcome_emoji", type: "string", required: false, defaultValue: "⚙️", description: "Outcome emoji" },
      { name: "description", type: "string", required: true, defaultValue: null, description: "Execution description" },
      { name: "resources_changed", type: "number", required: true, defaultValue: null, description: "Number of changed resources" },
      { name: "duration_seconds", type: "number", required: true, defaultValue: null, description: "Execution duration" },
      { name: "provider", type: "string", required: true, defaultValue: null, description: "Cloud provider" },
      { name: "region", type: "string", required: true, defaultValue: null, description: "Region" },
    ],
    actionButtons: [
      { id: "view-execution", label: "View Details", actionType: "view_details", url: null, payload: {}, requiresConfirmation: false },
    ],
    priority: "medium",
  },
  // Cost templates
  {
    id: "cost-anomaly-alert",
    name: "Cost Anomaly Alert",
    category: "cost",
    channel: "slack",
    subjectTemplate: "💰 Cost Anomaly: {{anomaly_type}} on {{affected_dimension}}",
    bodyTemplate: "**Cost Anomaly Detected**\n\n**Type:** {{anomaly_type}}\n**Affected:** {{affected_dimension}}\n**Expected:** ${{expected_cost}}\n**Actual:** ${{actual_cost}}\n**Deviation:** {{deviation_percent}}%\n**Provider:** {{provider}}",
    variables: [
      { name: "anomaly_type", type: "string", required: true, defaultValue: null, description: "Anomaly type" },
      { name: "affected_dimension", type: "string", required: true, defaultValue: null, description: "Affected cost dimension" },
      { name: "expected_cost", type: "number", required: true, defaultValue: null, description: "Expected cost" },
      { name: "actual_cost", type: "number", required: true, defaultValue: null, description: "Actual cost" },
      { name: "deviation_percent", type: "number", required: true, defaultValue: null, description: "Deviation percentage" },
      { name: "provider", type: "string", required: true, defaultValue: null, description: "Cloud provider" },
    ],
    actionButtons: [
      { id: "investigate", label: "Investigate", actionType: "view_details", url: null, payload: {}, requiresConfirmation: false },
      { id: "suppress", label: "Suppress", actionType: "snooze", url: null, payload: { duration: "24h" }, requiresConfirmation: true },
    ],
    priority: "high",
  },
  // Compliance templates
  {
    id: "compliance-drift-alert",
    name: "Compliance Drift Alert",
    category: "compliance",
    channel: "slack",
    subjectTemplate: "⚠️ Compliance Drift: {{control_title}}",
    bodyTemplate: "**Compliance Drift Detected**\n\n**Control:** {{control_id}} — {{control_title}}\n**Framework:** {{framework}}\n**Previous Status:** {{previous_status}}\n**New Status:** {{new_status}}\n**Affected Resources:** {{affected_resources}}\n**Severity:** {{severity}}",
    variables: [
      { name: "control_id", type: "string", required: true, defaultValue: null, description: "Control ID" },
      { name: "control_title", type: "string", required: true, defaultValue: null, description: "Control title" },
      { name: "framework", type: "string", required: true, defaultValue: null, description: "Compliance framework" },
      { name: "previous_status", type: "string", required: true, defaultValue: null, description: "Previous compliance status" },
      { name: "new_status", type: "string", required: true, defaultValue: null, description: "New compliance status" },
      { name: "affected_resources", type: "string", required: true, defaultValue: null, description: "Affected resources" },
      { name: "severity", type: "string", required: true, defaultValue: null, description: "Control severity" },
    ],
    actionButtons: [
      { id: "remediate", label: "Auto-Remediate", actionType: "approve", url: null, payload: {}, requiresConfirmation: true },
      { id: "view", label: "View Control", actionType: "view_details", url: null, payload: {}, requiresConfirmation: false },
    ],
    priority: "high",
  },
  // Security templates
  {
    id: "security-alert-critical",
    name: "Critical Security Alert",
    category: "security",
    channel: "pagerduty",
    subjectTemplate: "SECURITY: {{title}}",
    bodyTemplate: "**Critical Security Alert**\n\n**Title:** {{title}}\n**Signal:** {{signal_description}}\n**Affected Resources:** {{affected_resources}}\n**Provider:** {{provider}} / {{region}}\n**Confidence:** {{confidence}}",
    variables: [
      { name: "title", type: "string", required: true, defaultValue: null, description: "Alert title" },
      { name: "signal_description", type: "string", required: true, defaultValue: null, description: "Signal description" },
      { name: "affected_resources", type: "string", required: true, defaultValue: null, description: "Affected resources" },
      { name: "provider", type: "string", required: true, defaultValue: null, description: "Cloud provider" },
      { name: "region", type: "string", required: true, defaultValue: null, description: "Region" },
      { name: "confidence", type: "string", required: true, defaultValue: null, description: "Detection confidence" },
    ],
    actionButtons: [
      { id: "ack", label: "Acknowledge", actionType: "acknowledge", url: null, payload: {}, requiresConfirmation: false },
    ],
    priority: "critical",
  },
  // Digest template
  {
    id: "daily-digest",
    name: "Daily Operations Digest",
    category: "digest",
    channel: "email",
    subjectTemplate: "Axiom Agent Daily Digest — {{date}}",
    bodyTemplate: "**Daily Operations Summary**\n\n**Incidents:** {{incident_count}} ({{sev1_count}} SEV1, {{sev2_count}} SEV2)\n**Signals:** {{signal_count}} detected, {{auto_resolved_count}} auto-resolved\n**Executions:** {{execution_count}} completed, {{rollback_count}} rolled back\n**Cost:** ${{daily_cost}} ({{cost_trend}} from yesterday)\n**Compliance:** {{compliance_score}}% across {{framework_count}} frameworks\n**Optimization:** ${{savings_identified}} in savings identified",
    variables: [
      { name: "date", type: "date", required: true, defaultValue: null, description: "Digest date" },
      { name: "incident_count", type: "number", required: true, defaultValue: 0, description: "Total incidents" },
      { name: "sev1_count", type: "number", required: true, defaultValue: 0, description: "SEV1 incidents" },
      { name: "sev2_count", type: "number", required: true, defaultValue: 0, description: "SEV2 incidents" },
      { name: "signal_count", type: "number", required: true, defaultValue: 0, description: "Total signals" },
      { name: "auto_resolved_count", type: "number", required: true, defaultValue: 0, description: "Auto-resolved signals" },
      { name: "execution_count", type: "number", required: true, defaultValue: 0, description: "Completed executions" },
      { name: "rollback_count", type: "number", required: true, defaultValue: 0, description: "Rolled back executions" },
      { name: "daily_cost", type: "number", required: true, defaultValue: 0, description: "Daily cost" },
      { name: "cost_trend", type: "string", required: true, defaultValue: "stable", description: "Cost trend" },
      { name: "compliance_score", type: "number", required: true, defaultValue: 0, description: "Compliance score" },
      { name: "framework_count", type: "number", required: true, defaultValue: 0, description: "Active frameworks" },
      { name: "savings_identified", type: "number", required: true, defaultValue: 0, description: "Savings identified" },
    ],
    actionButtons: [
      { id: "view-dashboard", label: "View Dashboard", actionType: "view_details", url: null, payload: {}, requiresConfirmation: false },
    ],
    priority: "low",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Channel Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChannelConfig {
  channel: NotificationChannel;
  enabled: boolean;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  retryPolicy: RetryPolicy;
  deliveryGuarantee: "at_least_once" | "best_effort";
  supportedPriorities: NotificationPriority[];
  requiresConfiguration: string[];
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxRetryDelayMs: number;
}

export const CHANNEL_CONFIGS: ChannelConfig[] = [
  { channel: "slack", enabled: true, rateLimitPerMinute: 30, rateLimitPerHour: 500, retryPolicy: { maxRetries: 3, retryDelayMs: 5_000, backoffMultiplier: 2, maxRetryDelayMs: 60_000 }, deliveryGuarantee: "at_least_once", supportedPriorities: ["critical", "high", "medium", "low", "informational"], requiresConfiguration: ["webhook_url", "channel_id"] },
  { channel: "email", enabled: true, rateLimitPerMinute: 10, rateLimitPerHour: 100, retryPolicy: { maxRetries: 3, retryDelayMs: 30_000, backoffMultiplier: 2, maxRetryDelayMs: 300_000 }, deliveryGuarantee: "at_least_once", supportedPriorities: ["critical", "high", "medium", "low", "informational"], requiresConfiguration: ["smtp_host", "from_address"] },
  { channel: "pagerduty", enabled: true, rateLimitPerMinute: 10, rateLimitPerHour: 60, retryPolicy: { maxRetries: 5, retryDelayMs: 5_000, backoffMultiplier: 2, maxRetryDelayMs: 120_000 }, deliveryGuarantee: "at_least_once", supportedPriorities: ["critical", "high"], requiresConfiguration: ["routing_key"] },
  { channel: "sms", enabled: true, rateLimitPerMinute: 5, rateLimitPerHour: 30, retryPolicy: { maxRetries: 2, retryDelayMs: 10_000, backoffMultiplier: 2, maxRetryDelayMs: 60_000 }, deliveryGuarantee: "best_effort", supportedPriorities: ["critical", "high"], requiresConfiguration: ["phone_number", "provider_api_key"] },
  { channel: "webhook", enabled: true, rateLimitPerMinute: 60, rateLimitPerHour: 1000, retryPolicy: { maxRetries: 5, retryDelayMs: 5_000, backoffMultiplier: 2, maxRetryDelayMs: 120_000 }, deliveryGuarantee: "at_least_once", supportedPriorities: ["critical", "high", "medium", "low", "informational"], requiresConfiguration: ["endpoint_url"] },
  { channel: "microsoft_teams", enabled: true, rateLimitPerMinute: 20, rateLimitPerHour: 300, retryPolicy: { maxRetries: 3, retryDelayMs: 5_000, backoffMultiplier: 2, maxRetryDelayMs: 60_000 }, deliveryGuarantee: "at_least_once", supportedPriorities: ["critical", "high", "medium", "low", "informational"], requiresConfiguration: ["webhook_url"] },
  { channel: "in_app", enabled: true, rateLimitPerMinute: 100, rateLimitPerHour: 5000, retryPolicy: { maxRetries: 0, retryDelayMs: 0, backoffMultiplier: 1, maxRetryDelayMs: 0 }, deliveryGuarantee: "best_effort", supportedPriorities: ["critical", "high", "medium", "low", "informational"], requiresConfiguration: [] },
  { channel: "opsgenie", enabled: true, rateLimitPerMinute: 10, rateLimitPerHour: 60, retryPolicy: { maxRetries: 5, retryDelayMs: 5_000, backoffMultiplier: 2, maxRetryDelayMs: 120_000 }, deliveryGuarantee: "at_least_once", supportedPriorities: ["critical", "high"], requiresConfiguration: ["api_key"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Routing Rules
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationRoutingRule {
  id: string;
  name: string;
  description: string;
  conditions: RoutingCondition[];
  channels: NotificationChannel[];
  recipients: string[];
  templateOverride: string | null;
  priorityOverride: NotificationPriority | null;
  enabled: boolean;
  order: number;
}

export interface RoutingCondition {
  field: "category" | "priority" | "provider" | "environment" | "team" | "severity";
  operator: "eq" | "neq" | "in" | "not_in";
  value: unknown;
}

export const DEFAULT_ROUTING_RULES: NotificationRoutingRule[] = [
  { id: "sev1-all-channels", name: "SEV1 All Channels", description: "SEV1 incidents notify on all critical channels", conditions: [{ field: "category", operator: "eq", value: "incident" }, { field: "severity", operator: "eq", value: "sev1" }], channels: ["pagerduty", "slack", "sms", "email"], recipients: ["on_call_primary", "on_call_secondary", "engineering_manager"], templateOverride: null, priorityOverride: "critical", enabled: true, order: 1 },
  { id: "security-critical", name: "Security Critical", description: "Critical security alerts to security team", conditions: [{ field: "category", operator: "eq", value: "security" }, { field: "priority", operator: "eq", value: "critical" }], channels: ["pagerduty", "slack"], recipients: ["security_team", "ciso"], templateOverride: "security-alert-critical", priorityOverride: null, enabled: true, order: 2 },
  { id: "approval-requests", name: "Approval Requests", description: "Route approval requests to approvers", conditions: [{ field: "category", operator: "eq", value: "approval_request" }], channels: ["slack", "email"], recipients: ["approvers"], templateOverride: "approval-request", priorityOverride: null, enabled: true, order: 3 },
  { id: "cost-alerts", name: "Cost Alerts", description: "Cost anomalies to finance and ops teams", conditions: [{ field: "category", operator: "eq", value: "cost" }], channels: ["slack", "email"], recipients: ["finance_team", "ops_team"], templateOverride: null, priorityOverride: null, enabled: true, order: 4 },
  { id: "compliance-drift", name: "Compliance Drift", description: "Compliance drift to security and compliance teams", conditions: [{ field: "category", operator: "eq", value: "compliance" }], channels: ["slack", "email"], recipients: ["compliance_team", "security_team"], templateOverride: null, priorityOverride: null, enabled: true, order: 5 },
  { id: "daily-digest", name: "Daily Digest", description: "Daily digest to org admins", conditions: [{ field: "category", operator: "eq", value: "digest" }], channels: ["email"], recipients: ["org_admins"], templateOverride: "daily-digest", priorityOverride: "low", enabled: true, order: 10 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Digest & Aggregation
// ═══════════════════════════════════════════════════════════════════════════════

export interface DigestConfig {
  orgId: string;
  enabled: boolean;
  frequency: "hourly" | "daily" | "weekly";
  deliveryTime: string;
  timezone: string;
  channels: NotificationChannel[];
  recipients: string[];
  includeSections: DigestSection[];
  suppressDuplicates: boolean;
  minimumNotificationsToSend: number;
}

export type DigestSection = "incidents" | "signals" | "executions" | "cost" | "compliance" | "optimization" | "security";

export const DEFAULT_DIGEST_CONFIG: DigestConfig = {
  orgId: "",
  enabled: true,
  frequency: "daily",
  deliveryTime: "08:00",
  timezone: "UTC",
  channels: ["email", "slack"],
  recipients: ["org_admins", "ops_team"],
  includeSections: ["incidents", "signals", "executions", "cost", "compliance", "optimization", "security"],
  suppressDuplicates: true,
  minimumNotificationsToSend: 1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Notification Preferences
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserNotificationPreferences {
  userId: string;
  orgId: string;
  enabledChannels: NotificationChannel[];
  quietHours: QuietHoursConfig | null;
  categoryPreferences: Record<NotificationCategory, CategoryPreference>;
  digestPreference: "none" | "hourly" | "daily" | "weekly";
  escalationOverride: boolean;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  bypassForCritical: boolean;
  bypassForSev1: boolean;
}

export interface CategoryPreference {
  enabled: boolean;
  channels: NotificationChannel[];
  minimumPriority: NotificationPriority;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Notification Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationPipelineStageId =
  | "event_intake"
  | "template_resolution"
  | "routing"
  | "preference_filtering"
  | "deduplication"
  | "rate_limiting"
  | "rendering"
  | "delivery"
  | "confirmation"
  | "audit";

export interface NotificationPipelineStage {
  id: NotificationPipelineStageId;
  name: string;
  description: string;
  order: number;
  required: boolean;
  timeoutMs: number;
  dependsOn: NotificationPipelineStageId[];
}

export const NOTIFICATION_PIPELINE: NotificationPipelineStage[] = [
  { id: "event_intake", name: "Event Intake", description: "Receive notification event from source module", order: 1, required: true, timeoutMs: 5_000, dependsOn: [] },
  { id: "template_resolution", name: "Template Resolution", description: "Select and validate notification template", order: 2, required: true, timeoutMs: 5_000, dependsOn: ["event_intake"] },
  { id: "routing", name: "Routing", description: "Apply routing rules to determine channels and recipients", order: 3, required: true, timeoutMs: 5_000, dependsOn: ["template_resolution"] },
  { id: "preference_filtering", name: "Preference Filtering", description: "Apply user preferences and quiet hours", order: 4, required: true, timeoutMs: 5_000, dependsOn: ["routing"] },
  { id: "deduplication", name: "Deduplication", description: "Suppress duplicate notifications within window", order: 5, required: true, timeoutMs: 3_000, dependsOn: ["preference_filtering"] },
  { id: "rate_limiting", name: "Rate Limiting", description: "Enforce per-channel rate limits", order: 6, required: true, timeoutMs: 3_000, dependsOn: ["deduplication"] },
  { id: "rendering", name: "Rendering", description: "Render template with variables for each channel", order: 7, required: true, timeoutMs: 10_000, dependsOn: ["rate_limiting"] },
  { id: "delivery", name: "Delivery", description: "Deliver notification via channel provider", order: 8, required: true, timeoutMs: 30_000, dependsOn: ["rendering"] },
  { id: "confirmation", name: "Delivery Confirmation", description: "Confirm delivery and track status", order: 9, required: true, timeoutMs: 10_000, dependsOn: ["delivery"] },
  { id: "audit", name: "Audit Recording", description: "Record notification in audit trail", order: 10, required: true, timeoutMs: 5_000, dependsOn: ["confirmation"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationIntegrationTarget =
  | "incident_response"
  | "signal_detection"
  | "execution_safety"
  | "cost_intelligence"
  | "compliance_engine"
  | "governance_engine"
  | "coordination_framework"
  | "observability"
  | "org_intelligence"
  | "memory_system";

export interface NotificationIntegrationContract {
  target: NotificationIntegrationTarget;
  direction: "consumes" | "produces" | "bidirectional";
  description: string;
  dataFlow: string;
}

export const NOTIFICATION_INTEGRATION_CONTRACTS: NotificationIntegrationContract[] = [
  { target: "incident_response", direction: "consumes", description: "Receives incident lifecycle events for notification", dataFlow: "IncidentEvent → NotificationEvent" },
  { target: "signal_detection", direction: "consumes", description: "Receives triaged signals for alerting", dataFlow: "TriagedSignal → NotificationEvent" },
  { target: "execution_safety", direction: "consumes", description: "Receives execution status events", dataFlow: "ExecutionEvent → NotificationEvent" },
  { target: "cost_intelligence", direction: "consumes", description: "Receives cost anomaly and report events", dataFlow: "CostEvent → NotificationEvent" },
  { target: "compliance_engine", direction: "consumes", description: "Receives compliance drift and assessment events", dataFlow: "ComplianceEvent → NotificationEvent" },
  { target: "governance_engine", direction: "consumes", description: "Receives approval requests and decisions", dataFlow: "GovernanceEvent → NotificationEvent" },
  { target: "coordination_framework", direction: "consumes", description: "Receives workflow coordination events", dataFlow: "CoordinationEvent → NotificationEvent" },
  { target: "observability", direction: "produces", description: "Emits notification delivery metrics", dataFlow: "DeliveryMetric → ObservabilityPipeline" },
  { target: "org_intelligence", direction: "consumes", description: "Applies org notification preferences", dataFlow: "OrgPreferences → NotificationConfig" },
  { target: "memory_system", direction: "produces", description: "Records notification patterns for learning", dataFlow: "NotificationPattern → OperationalMemory" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getNotificationTemplate(id: string): NotificationTemplate | undefined {
  return NOTIFICATION_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: NotificationCategory): NotificationTemplate[] {
  return NOTIFICATION_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByChannel(channel: NotificationChannel): NotificationTemplate[] {
  return NOTIFICATION_TEMPLATES.filter((t) => t.channel === channel);
}

export function getChannelConfig(channel: NotificationChannel): ChannelConfig | undefined {
  return CHANNEL_CONFIGS.find((c) => c.channel === channel);
}

export function getEnabledChannels(): ChannelConfig[] {
  return CHANNEL_CONFIGS.filter((c) => c.enabled);
}

export function getChannelsForPriority(priority: NotificationPriority): ChannelConfig[] {
  return CHANNEL_CONFIGS.filter((c) => c.enabled && c.supportedPriorities.includes(priority));
}

export function getRoutingRule(id: string): NotificationRoutingRule | undefined {
  return DEFAULT_ROUTING_RULES.find((r) => r.id === id);
}

export function getEnabledRoutingRules(): NotificationRoutingRule[] {
  return DEFAULT_ROUTING_RULES.filter((r) => r.enabled).sort((a, b) => a.order - b.order);
}

export function getNotificationPipelineStage(id: NotificationPipelineStageId): NotificationPipelineStage | undefined {
  return NOTIFICATION_PIPELINE.find((s) => s.id === id);
}

export function getNotificationPipelineOrder(): NotificationPipelineStageId[] {
  return [...NOTIFICATION_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.id);
}

export function getNotificationIntegration(target: NotificationIntegrationTarget): NotificationIntegrationContract | undefined {
  return NOTIFICATION_INTEGRATION_CONTRACTS.find((c) => c.target === target);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface NotificationEngineTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runNotificationEngineTests(): NotificationEngineTestResult[] {
  const results: NotificationEngineTestResult[] = [];
  const assert = (name: string, condition: boolean, msg: string) => {
    results.push({ name, passed: condition, message: condition ? "OK" : msg });
  };

  // §1 — Architecture
  assert("channels-8", (["slack", "email", "pagerduty", "sms", "webhook", "microsoft_teams", "in_app", "opsgenie"] as NotificationChannel[]).length === 8, "Should have 8 channels");
  assert("categories-12", (["incident", "signal", "execution", "approval_request", "approval_decision", "compliance", "cost", "security", "drift", "scheduled", "system", "digest"] as NotificationCategory[]).length === 12, "Should have 12 categories");

  // §2 — Templates
  assert("templates-8", NOTIFICATION_TEMPLATES.length === 8, "Should have 8 templates");
  assert("sev1-template", getNotificationTemplate("incident-sev1-created") !== undefined, "SEV1 template should exist");
  assert("approval-template", getNotificationTemplate("approval-request") !== undefined, "Approval template should exist");
  assert("digest-template", getNotificationTemplate("daily-digest") !== undefined, "Digest template should exist");
  assert("incident-templates", getTemplatesByCategory("incident").length >= 2, "Should have 2+ incident templates");
  assert("all-templates-have-variables", NOTIFICATION_TEMPLATES.every((t) => t.variables.length > 0), "All templates must have variables");

  // §3 — Channel Configs
  assert("channel-configs-8", CHANNEL_CONFIGS.length === 8, "Should have 8 channel configs");
  assert("all-channels-enabled", getEnabledChannels().length === 8, "All channels should be enabled by default");
  assert("critical-channels", getChannelsForPriority("critical").length >= 6, "Critical should have 6+ channels");
  assert("pagerduty-critical-only", getChannelConfig("pagerduty")?.supportedPriorities.length === 2, "PagerDuty should support critical and high only");
  assert("slack-config", getChannelConfig("slack")?.rateLimitPerMinute === 30, "Slack should allow 30/min");

  // §4 — Routing Rules
  assert("routing-rules-6", DEFAULT_ROUTING_RULES.length === 6, "Should have 6 routing rules");
  assert("enabled-rules", getEnabledRoutingRules().length === 6, "All rules should be enabled");
  assert("sev1-all-channels", getRoutingRule("sev1-all-channels")?.channels.length === 4, "SEV1 should route to 4 channels");
  assert("rules-ordered", getEnabledRoutingRules().every((r, i) => i === 0 || r.order >= getEnabledRoutingRules()[i - 1].order), "Rules should be ordered");

  // §7 — Pipeline
  assert("pipeline-10-stages", NOTIFICATION_PIPELINE.length === 10, "Should have 10 pipeline stages");
  assert("pipeline-ordered", NOTIFICATION_PIPELINE.every((s, i) => i === 0 || s.order >= NOTIFICATION_PIPELINE[i - 1].order), "Pipeline should be ordered");
  assert("event-intake-first", getNotificationPipelineStage("event_intake")?.order === 1, "Event intake should be first");
  assert("audit-last", getNotificationPipelineStage("audit")?.order === 10, "Audit should be last");

  // §8 — Integration Contracts
  assert("integration-contracts-10", NOTIFICATION_INTEGRATION_CONTRACTS.length === 10, "Should have 10 integration contracts");
  assert("incident-integration", getNotificationIntegration("incident_response")?.direction === "consumes", "Should consume from incident response");
  assert("observability-produces", getNotificationIntegration("observability")?.direction === "produces", "Should produce to observability");

  return results;
}
