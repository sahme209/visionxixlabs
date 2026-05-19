/**
 * Telemetry Ingestion builder.
 *
 * Pure read-only composition. Per-provider posture honors canonical
 * provider mode + a small static catalog of telemetry providers
 * Axiom can integrate with. Until each SDK / webhook lands, signal
 * lists stay empty — no synthesised alerts ever.
 */

import "server-only";

import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { loadAppEnv } from "@/lib/config/env";
import { readTelemetryQueue } from "./telemetryWebhookReceiver";
import { extractAwsCloudWatchAlarms } from "./awsCloudWatchExtractor";
import { extractDatadogAlertingMonitors } from "./datadogPullExtractor";
import { extractSentryUnresolvedIssues } from "./sentryPullExtractor";
import { extractDynatraceProblems } from "./dynatracePullExtractor";
import { extractNewRelicIssues } from "./newRelicPullExtractor";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
import type {
  TelemetryIngestReport,
  TelemetryProvider,
  TelemetryProviderPosture,
  TelemetrySignal,
  TelemetrySignalKind,
  TelemetrySeverity,
  TelemetrySourceMode,
} from "./telemetryIngestModel";

export interface BuildTelemetryInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildTelemetryIngest(input: BuildTelemetryInput): Promise<TelemetryIngestReport> {
  const env = loadAppEnv();
  const state = await buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId });
  const awsLive = state.providers.find((p) => p.provider === "aws")?.mode === "live";

  // Try live CloudWatch alarm pull.
  let cwLive: Awaited<ReturnType<typeof extractAwsCloudWatchAlarms>> | null = null;
  if (awsLive && env.awsCloudWatchPullEnabled) {
    try {
      cwLive = await extractAwsCloudWatchAlarms();
    } catch {
      cwLive = null;
    }
  }

  // Try live Datadog pull.
  let ddLive: Awaited<ReturnType<typeof extractDatadogAlertingMonitors>> | null = null;
  if (env.datadogPullEnabled) {
    try {
      ddLive = await extractDatadogAlertingMonitors();
    } catch {
      ddLive = null;
    }
  }

  // Try live Sentry pull.
  let sentryLive: Awaited<ReturnType<typeof extractSentryUnresolvedIssues>> | null = null;
  if (env.sentryPullEnabled) {
    try {
      sentryLive = await extractSentryUnresolvedIssues();
    } catch {
      sentryLive = null;
    }
  }

  // Try live Dynatrace pull.
  let dynatraceLive: Awaited<ReturnType<typeof extractDynatraceProblems>> | null = null;
  if (env.dynatracePullEnabled) {
    try {
      dynatraceLive = await extractDynatraceProblems();
    } catch {
      dynatraceLive = null;
    }
  }

  // Try live New Relic pull.
  let newRelicLive: Awaited<ReturnType<typeof extractNewRelicIssues>> | null = null;
  if (env.newRelicPullEnabled) {
    try {
      newRelicLive = await extractNewRelicIssues();
    } catch {
      newRelicLive = null;
    }
  }
  const azureLive = state.providers.find((p) => p.provider === "azure")?.mode === "live";
  const gcpLive = state.providers.find((p) => p.provider === "gcp")?.mode === "live";

  const providers: TelemetryProviderPosture[] = [
    posture("aws_cloudwatch", awsLive ? "partial_live" : "preview", [
      "logs:DescribeLogGroups + cloudwatch:DescribeAlarms on the broker IAM role.",
    ], "https://console.aws.amazon.com/cloudwatch/"),
    posture("aws_xray", awsLive ? "partial_live" : "preview", [
      "xray:GetTraceSummaries + xray:BatchGetTraces.",
    ], "https://console.aws.amazon.com/xray/"),
    posture("azure_monitor", azureLive ? "partial_live" : "preview", [
      "Monitoring Reader role on the subscription + AZURE_LOG_ANALYTICS_WORKSPACE_ID.",
    ], "https://portal.azure.com/#blade/Microsoft_Azure_Monitoring"),
    posture("azure_log_analytics", azureLive ? "partial_live" : "preview", [
      "AZURE_LOG_ANALYTICS_WORKSPACE_ID + LogAnalyticsReader role.",
    ]),
    posture("gcp_cloud_logging", gcpLive ? "partial_live" : "preview", [
      "logging.viewer role on the project.",
    ], "https://console.cloud.google.com/logs/"),
    posture("gcp_cloud_monitoring", gcpLive ? "partial_live" : "preview", [
      "monitoring.viewer role + GCP_CLOUD_MONITORING_WORKSPACE.",
    ]),
    posture("datadog", "preview", ["DATADOG_API_KEY + DATADOG_APP_KEY."], "https://app.datadoghq.com/"),
    posture("grafana_cloud", "preview", ["GRAFANA_CLOUD_TOKEN with metrics:read + logs:read."], "https://grafana.com/"),
    posture("prometheus", "preview", ["PROMETHEUS_URL + (optional) PROMETHEUS_BEARER_TOKEN."]),
    posture("sentry", "preview", ["SENTRY_AUTH_TOKEN with org:read + project:read."], "https://sentry.io/"),
    posture("new_relic", "preview", ["NEW_RELIC_USER_KEY + NEW_RELIC_ACCOUNT_ID."], "https://one.newrelic.com/"),
    posture("dynatrace", "preview", ["DYNATRACE_ENV_URL + DYNATRACE_API_TOKEN (Read problems scope)."], "https://www.dynatrace.com/"),
    posture("opentelemetry_collector", "preview", ["OTEL_COLLECTOR_URL (push or pull)."]),
  ];

  // ---------------------------------------------------------------------------
  // Drain the inbound webhook queue into the per-provider postures.
  // ---------------------------------------------------------------------------
  const inbound = readTelemetryQueue();
  for (const sig of inbound) {
    const target = providers.find((p) => p.provider === sig.sourceProvider);
    if (target) {
      target.signals.push(sig);
      target.mode = "live";
      target.headline = `Live · ${target.signals.length} signal(s) ingested via webhook.`;
    }
  }

  // ---------------------------------------------------------------------------
  // Splice live-pulled CloudWatch alarm state into the aws_cloudwatch posture.
  // ---------------------------------------------------------------------------
  if (cwLive && cwLive.mode === "live" && cwLive.signals.length > 0) {
    const target = providers.find((p) => p.provider === "aws_cloudwatch");
    if (target) {
      for (const sig of cwLive.signals) target.signals.push(sig);
      target.mode = "live";
      target.headline = `Live · ${target.signals.length} CloudWatch alarm(s) pulled from DescribeAlarms.`;
      target.missingRequirements = [];
      target.configured = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Splice live-pulled Datadog monitors into the datadog posture.
  // ---------------------------------------------------------------------------
  if (ddLive && ddLive.mode === "live" && ddLive.signals.length > 0) {
    const target = providers.find((p) => p.provider === "datadog");
    if (target) {
      for (const sig of ddLive.signals) target.signals.push(sig);
      target.mode = "live";
      target.headline = `Live · ${target.signals.length} Datadog monitor(s) in alert/warn state.`;
      target.missingRequirements = [];
      target.configured = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Splice live-pulled Sentry unresolved issues into the sentry posture.
  // ---------------------------------------------------------------------------
  if (sentryLive && sentryLive.mode === "live" && sentryLive.signals.length > 0) {
    const target = providers.find((p) => p.provider === "sentry");
    if (target) {
      for (const sig of sentryLive.signals) target.signals.push(sig);
      target.mode = "live";
      target.headline = `Live · ${target.signals.length} unresolved Sentry issue(s).`;
      target.missingRequirements = [];
      target.configured = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Splice live-pulled Dynatrace problems into the dynatrace posture.
  // ---------------------------------------------------------------------------
  if (dynatraceLive && dynatraceLive.mode === "live" && dynatraceLive.signals.length > 0) {
    const target = providers.find((p) => p.provider === "dynatrace");
    if (target) {
      for (const sig of dynatraceLive.signals) target.signals.push(sig);
      target.mode = "live";
      target.headline = `Live · ${target.signals.length} open Dynatrace problem(s).`;
      target.missingRequirements = [];
      target.configured = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Splice live-pulled New Relic issues into the new_relic posture.
  // ---------------------------------------------------------------------------
  if (newRelicLive && newRelicLive.mode === "live" && newRelicLive.signals.length > 0) {
    const target = providers.find((p) => p.provider === "new_relic");
    if (target) {
      for (const sig of newRelicLive.signals) target.signals.push(sig);
      target.mode = "live";
      target.headline = `Live · ${target.signals.length} active New Relic issue(s).`;
      target.missingRequirements = [];
      target.configured = true;
    }
  }

  const signals: TelemetrySignal[] = providers.flatMap((p) => p.signals);
  const liveCount = providers.filter((p) => p.mode === "live").length;

  const signalsBySeverity: Record<TelemetrySeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const signalsByKind: Record<TelemetrySignalKind, number> = {
    log_anomaly: 0, metric_breach: 0, trace_latency_spike: 0,
    trace_error_rate_spike: 0, alert_firing: 0, alert_resolved: 0,
    saturation_threshold: 0, synthetic_check_failure: 0,
    cost_metric_breach: 0, security_event_emitted: 0,
  };
  for (const s of signals) { signalsBySeverity[s.severity]++; signalsByKind[s.kind]++; }

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    providers,
    signals,
    summary: {
      providerCount: providers.length,
      liveProviderCount: liveCount,
      signalsTotal: signals.length,
      signalsBySeverity,
      signalsByKind,
    },
    overallSourceMode: liveCount > 0 ? (liveCount === providers.length ? "live" : "partial_live") : "preview",
    safetyContract: "telemetry_ingest_read_only",
    limitations: [
      "Telemetry connectors are typed and ready. Per-provider SDK / webhook traversal lands in follow-up phases — until then, signal arrays stay empty (no fabricated alerts).",
      "The dispatcher (Phase 47 — closed-loop remediation) translates each TelemetrySignal into a canonical Risk Queue / Notification / Approval Packet entry.",
    ],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

function posture(
  provider: TelemetryProvider,
  rawMode: TelemetrySourceMode,
  missingRequirements: string[],
  externalConsoleHref?: string,
): TelemetryProviderPosture {
  const mode = rawMode;
  return {
    provider,
    mode,
    configured: mode === "live" || mode === "partial_live",
    headline: mode === "live"
      ? "Live telemetry connector — alert + log + trace stream active."
      : mode === "partial_live"
        ? "Provider live, telemetry SDK traversal still preview — emits no fabricated alerts."
        : "Preview — typed connector awaiting credentials.",
    signals: [],
    missingRequirements: mode === "live" ? [] : missingRequirements,
    externalConsoleHref,
    safeNextAction: { label: "Open Sources", href: "/dashboard/sources" },
  };
}
