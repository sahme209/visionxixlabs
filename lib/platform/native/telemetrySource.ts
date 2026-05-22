/**
 * Native Telemetry Source — typed model for the ingestion foundation.
 *
 * Anything that produces telemetry (logs, metrics, traces, events) is a
 * TelemetrySource. Some are connectors (Dynatrace, Grafana, CloudWatch),
 * some are native (the VisionXIXLabs desktop agent, our cron pingers),
 * some are client-pushed (HTTP/webhook ingest of their own metrics).
 *
 * This module defines the typed shape only — persistence lands in a
 * follow-up Prisma migration.
 */

import type { OrganizationId } from "@/lib/domain/ids";

export type TelemetrySourceKind =
  | "native_pinger"
  | "native_desktop_agent"
  | "webhook_ingest"
  | "connector_pull"
  | "connector_push"
  | "manual_upload";

export interface TelemetrySource {
  organizationId: OrganizationId;
  id: string;
  name: string;
  kind: TelemetrySourceKind;
  /** When the source feeds from a connector, this links back to the connector id. */
  connectorId?: string;
  /** What kind of signals this source produces. */
  signalKinds: Array<"log" | "metric" | "trace" | "event">;
  /** Optional: which Service this source is attached to. */
  attachedServiceId?: string;
  /** Source-mode honesty pill (live/preview/blocked). */
  state: "live" | "preview" | "blocked" | "disabled";
  /** Most recent successful ingest timestamp. */
  lastIngestAt?: string;
  /** Ingest rate over the last hour, in events/sec. */
  recentRate?: number;
}

export interface MetricSeries {
  organizationId: OrganizationId;
  sourceId: string;
  name: string;
  /** Dimension key/value pairs. */
  labels: Readonly<Record<string, string>>;
  /** Closed-union metric kind. */
  kind: "counter" | "gauge" | "histogram" | "summary";
  /** Unit string ("bytes", "ms", "errors/s", etc). */
  unit?: string;
}

export interface LogEvent {
  organizationId: OrganizationId;
  sourceId: string;
  /** ISO timestamp of the log line. */
  occurredAt: string;
  /** Severity tier. */
  severity: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  /** Free-text message (redacted before persistence). */
  message: string;
  /** Optional service this log is attached to. */
  serviceId?: string;
  /** Closed-union origin marker — native vs connector. */
  via: "native" | "connector" | "preview";
  /** Tags / labels. */
  labels?: Readonly<Record<string, string>>;
}

export interface TraceSpanRecord {
  organizationId: OrganizationId;
  sourceId: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  /** Span name — e.g. "POST /api/foo" */
  name: string;
  /** ISO timestamp of when the span started. */
  startedAt: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Status verdict. */
  status: "ok" | "error" | "cancelled";
  /** Optional service id this span belongs to. */
  serviceId?: string;
}

export interface IngestSummary {
  organizationId: OrganizationId;
  source: TelemetrySource;
  /** Counts in the last 24 hours. */
  last24h: {
    logEvents: number;
    metricPoints: number;
    traceSpans: number;
    discreteEvents: number;
  };
  /** Volume / cost honesty signals. */
  retentionDays?: number;
}
