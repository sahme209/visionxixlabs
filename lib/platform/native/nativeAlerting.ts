/**
 * Native Alerting Engine — typed model.
 *
 * The platform's own alert engine. Rules are defined once and apply to
 * native telemetry, connector telemetry, or business events. Alert
 * events flow into the native Incident model when severity + auto_create
 * are both set.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";

export type AlertSeverity = "info" | "warning" | "error" | "critical";

export type AlertTriggerKind =
  | "metric_threshold"   // a metric crosses a value over a window
  | "log_pattern"        // a log line matches a redacted pattern
  | "anomaly_detector"   // anomaly kernel verdict
  | "security_finding"   // native or connector security finding
  | "connector_health"   // connector itself went unhealthy
  | "scheduled_check"    // cron pinger or health probe
  | "manual";            // operator-raised alert

export type AlertChannel = "in_app" | "email" | "slack" | "teams" | "sms" | "webhook" | "pagerduty" | "opsgenie";

export interface AlertRule {
  organizationId: OrganizationId;
  id: string;
  /** Human label shown in the alerts UI. */
  name: string;
  /** Optional plain-English description. */
  description?: string;
  /** Source-of-truth kind for the trigger. */
  triggerKind: AlertTriggerKind;
  /** Severity assigned when this rule fires. */
  severity: AlertSeverity;
  /** Closed-union: which Service / TelemetrySource / connector this targets. */
  scope:
    | { kind: "service"; serviceId: string }
    | { kind: "telemetry_source"; sourceId: string }
    | { kind: "connector"; connectorId: string }
    | { kind: "organization" };
  /** Free-form typed condition payload — schema depends on triggerKind. */
  condition: Record<string, unknown>;
  /** Which channels to fan out to when the rule fires. */
  notify: readonly AlertChannel[];
  /** Whether to auto-create an Incident when this rule fires. */
  autoCreateIncident: boolean;
  /** Whether the rule is currently active. */
  enabled: boolean;
  /** Who created the rule. */
  createdByUserId?: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface AlertEvent {
  organizationId: OrganizationId;
  id: string;
  ruleId: string;
  severity: AlertSeverity;
  /** ISO timestamp of when the alert fired. */
  firedAt: string;
  /** ISO timestamp of when the alert auto-resolved (if it did). */
  resolvedAt?: string;
  /** State machine: open / acked / resolved / suppressed. */
  state: "open" | "acked" | "resolved" | "suppressed";
  /** Optional incident id when the alert was promoted. */
  incidentId?: string;
  /** Short summary of what fired. */
  summary: string;
  /** Evidence references — span ids, metric points, log ids. */
  evidence: ReadonlyArray<{ kind: string; ref: string; label?: string }>;
  /** Suggested next action — populated by the recommender kernel. */
  recommendedAction?: { label: string; href?: string; requiresApproval: boolean };
}
