/**
 * Telemetry Ingestion Lane — typed contract.
 *
 * Canonical model for every telemetry source the platform can read
 * (CloudWatch / Azure Monitor / GCP Logging / Datadog / Grafana /
 * Prometheus / Sentry / New Relic). Pure read-only ingestion — the
 * lane never writes back to the source.
 *
 * Every signal lands as a typed TelemetrySignal and gets routed
 * by the dispatcher (Phase 47) into the Risk Queue / Notifications /
 * Approval Packets pipeline. The autonomy loop never sees raw vendor
 * payloads; it only sees the typed canonical signal.
 *
 * safetyContract literal 'telemetry_ingest_read_only'.
 */

export type TelemetryProvider =
  | "aws_cloudwatch"
  | "aws_xray"
  | "azure_monitor"
  | "azure_log_analytics"
  | "gcp_cloud_logging"
  | "gcp_cloud_monitoring"
  | "datadog"
  | "grafana_cloud"
  | "prometheus"
  | "sentry"
  | "new_relic"
  | "dynatrace"
  | "opentelemetry_collector";

export type TelemetrySourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "blocked"
  | "disabled"
  | "unknown";

export type TelemetrySignalKind =
  | "log_anomaly"
  | "metric_breach"
  | "trace_latency_spike"
  | "trace_error_rate_spike"
  | "alert_firing"
  | "alert_resolved"
  | "saturation_threshold"
  | "synthetic_check_failure"
  | "cost_metric_breach"
  | "security_event_emitted";

export type TelemetrySeverity = "critical" | "high" | "medium" | "low" | "info";

export interface TelemetrySignal {
  id: string;
  kind: TelemetrySignalKind;
  severity: TelemetrySeverity;
  /** Affected service / resource / endpoint. */
  scope: string;
  /** Operator-readable headline. */
  headline: string;
  /** Detail line. */
  detail: string;
  /** Timestamp when the signal fired in the source system. */
  firedAt: string;
  /** Source provider. */
  sourceProvider: TelemetryProvider;
  /** Evidence ref (alert id, log query, trace id). */
  evidenceRef: string;
  /** Honest preview / live tag. */
  sourceMode: TelemetrySourceMode;
  /** Confidence 0..1. Lower for synthesised / preview signals. */
  confidence: number;
  /** Operator-actionable next step (never a mutation). */
  safeNextAction: { label: string; href: string };
}

export interface TelemetryProviderPosture {
  provider: TelemetryProvider;
  mode: TelemetrySourceMode;
  configured: boolean;
  headline: string;
  signals: TelemetrySignal[];
  missingRequirements: string[];
  externalConsoleHref?: string;
  safeNextAction: { label: string; href: string };
}

export interface TelemetryIngestReport {
  generatedAt: string;
  tenantId?: string;
  providers: TelemetryProviderPosture[];
  signals: TelemetrySignal[];
  summary: {
    providerCount: number;
    liveProviderCount: number;
    signalsTotal: number;
    signalsBySeverity: Record<TelemetrySeverity, number>;
    signalsByKind: Record<TelemetrySignalKind, number>;
  };
  overallSourceMode: TelemetrySourceMode;
  /** Hard literal. */
  safetyContract: "telemetry_ingest_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const TELEMETRY_PROVIDER_LABEL: Record<TelemetryProvider, string> = {
  aws_cloudwatch:          "AWS CloudWatch",
  aws_xray:                "AWS X-Ray",
  azure_monitor:           "Azure Monitor",
  azure_log_analytics:     "Azure Log Analytics",
  gcp_cloud_logging:       "GCP Cloud Logging",
  gcp_cloud_monitoring:    "GCP Cloud Monitoring",
  datadog:                 "Datadog",
  grafana_cloud:           "Grafana Cloud",
  prometheus:              "Prometheus",
  sentry:                  "Sentry",
  new_relic:               "New Relic",
  dynatrace:               "Dynatrace",
  opentelemetry_collector: "OpenTelemetry Collector",
};

export const TELEMETRY_KIND_LABEL: Record<TelemetrySignalKind, string> = {
  log_anomaly:                "Log anomaly",
  metric_breach:              "Metric breach",
  trace_latency_spike:        "Trace latency spike",
  trace_error_rate_spike:     "Trace error rate spike",
  alert_firing:               "Alert firing",
  alert_resolved:             "Alert resolved",
  saturation_threshold:       "Saturation threshold",
  synthetic_check_failure:    "Synthetic check failure",
  cost_metric_breach:         "Cost metric breach",
  security_event_emitted:     "Security event emitted",
};
