/**
 * Telemetry Webhook Receiver.
 *
 * Verifies incoming webhook credentials and stores normalized telemetry signals.
 * Downstream readers receive the normalized evidence.
 *
 * Currently supports:
 *   - Grafana Alertmanager webhook v4
 *   - Datadog webhook (custom payload)
 *   - Prometheus Alertmanager webhook
 *   - OpenTelemetry generic JSON
 *   - Sentry webhook
 *
 * Hard rules:
 *   - Webhook credentials are bound to a workspace and provider.
 *     Workspace hints never select the evidence owner.
 *   - Payloads pass through redactPayload before persistence.
 *   - The receiver stores typed evidence for read-only report consumers.
 */

import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { loadAppEnv } from "@/lib/config/env";
import { redactPayload } from "@/lib/api/redaction";
import {MAX_INBOUND_BODY_BYTES, MAX_INBOUND_OBSERVATIONS, storeInboundObservations} from "@/lib/observations/inboundObservationStore";
import type {
  TelemetryProvider,
  TelemetrySeverity,
  TelemetrySignal,
  TelemetrySignalKind,
} from "./telemetryIngestModel";

// ---------------------------------------------------------------------------
// Public entry — accepts vendor-typed inbound + emits canonical signal
// ---------------------------------------------------------------------------

export type ReceiverProvider = "grafana" | "datadog" | "prometheus" | "opentelemetry" | "sentry";

export interface ReceiveTelemetryInput {
  provider: ReceiverProvider;
  rawBody: string;
  /** Signature header (provider-specific). */
  signatureHeader: string | null;
  authorizationHeader?: string | null;
  signingBytes?: Buffer;
  sentryResource?: string;
  /** Optional sender workspace assertion. Must agree with the configured binding. */
  tenantHeader: string | null;
}

export interface ReceiveTelemetryResult {
  ok: boolean;
  status: number;
  /** Number of signals normalised this call. */
  enqueued: number;
  /** Reason / error code (only when !ok). */
  reason?: string;
  /** The normalized signals accepted by the durable store. */
  signals: TelemetrySignal[];
}

export async function receiveTelemetryWebhook(input: ReceiveTelemetryInput): Promise<ReceiveTelemetryResult> {
  const {
    telemetryWebhookSecret: secret, telemetryWebhookTenantId: tenantId, telemetryWebhookProvider: provider,
    telemetrySentryInstallationId, telemetryPrometheusBearerDigest,
  } = loadAppEnv();
  const bearerDigest = provider === "prometheus" ? telemetryPrometheusBearerDigest : undefined;
  if (!bearerDigest && !secret) {
    return { ok: false, status: 401, enqueued: 0, reason: "secret_not_configured", signals: [] };
  }
  if (!tenantId || !provider) {
    return { ok: false, status: 401, enqueued: 0, reason: "receiver_not_configured", signals: [] };
  }
  if (input.provider !== provider || (input.tenantHeader !== null && input.tenantHeader !== tenantId)) {
    return { ok: false, status: 401, enqueued: 0, reason: "invalid_source", signals: [] };
  }
  if (bearerDigest) {
    if (!verifyAlertmanagerBearer(bearerDigest, input.authorizationHeader)) {
      return { ok: false, status: 401, enqueued: 0, reason: "invalid_authorization", signals: [] };
    }
  } else {
    if (!input.signatureHeader) {
      return { ok: false, status: 401, enqueued: 0, reason: "missing_signature", signals: [] };
    }
    if (!secret || !verifyHmac(secret, input.signingBytes ?? input.rawBody, input.signatureHeader)) {
      return { ok: false, status: 401, enqueued: 0, reason: "invalid_signature", signals: [] };
    }
  }

  if (Buffer.byteLength(input.rawBody) > MAX_INBOUND_BODY_BYTES) {
    return {ok: false, status: 413, enqueued: 0, reason: "body_size_invalid", signals: []};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, status: 400, enqueued: 0, reason: "invalid_json", signals: [] };
  }
  const redacted = redactPayload(parsed);
  let signals: TelemetrySignal[];
  if (input.provider === "sentry" && input.sentryResource !== undefined) {
    if (input.sentryResource !== "issue") {
      return {ok: true, status: 202, enqueued: 0, signals: []};
    }
    const body = redacted as SentryIssueDelivery | null;
    const installation = body?.installation?.uuid;
    if (typeof installation !== "string" || !isSentryInstallationId(installation) ||
        installation.toLowerCase() !== telemetrySentryInstallationId) {
      return {ok: false, status: 401, enqueued: 0, reason: "invalid_source", signals: []};
    }
    signals = normaliseSentryIssue(body);
  } else {
    signals = normalise(input.provider, redacted);
  }
  if (signals.length === 0) {
    return { ok: true, status: 202, enqueued: 0, signals: [], reason: "no_signals_in_payload" };
  }

  if (signals.length > MAX_INBOUND_OBSERVATIONS) {
    return {ok: false, status: 413, enqueued: 0, reason: "batch_size_invalid", signals: []};
  }
  try {
    const enqueued = await storeInboundObservations(tenantId, "telemetry", provider, input.rawBody, signals);
    return {ok: true, status: 200, enqueued, signals: enqueued ? signals : []};
  } catch {
    return {ok: false, status: 503, enqueued: 0, reason: "storage_unavailable", signals: []};
  }
}

// ---------------------------------------------------------------------------
// HMAC verification
// ---------------------------------------------------------------------------

function verifyAlertmanagerBearer(expected: string, header: string | null | undefined): boolean {
  if (!header || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  const token = /^Bearer ([A-Za-z0-9._~+/-]{1,512}={0,2})$/i.exec(header)?.[1];
  if (!token) return false;
  const digest = createHash("sha256").update(token).digest();
  return timingSafeEqual(Buffer.from(expected, "hex"), digest);
}

function verifyHmac(secret: string, body: string | Buffer, signatureHeader: string): boolean {
  // Accept either raw hex digest or `sha256=<digest>` form.
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();
  const computed = createHmac("sha256", secret).update(body).digest("hex");
  if (provided.length !== computed.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Per-provider normalisers
// ---------------------------------------------------------------------------

function normalise(provider: ReceiverProvider, body: unknown): TelemetrySignal[] {
  switch (provider) {
    case "grafana":       return normaliseGrafana(body);
    case "datadog":       return normaliseDatadog(body);
    case "prometheus":    return normalisePrometheus(body);
    case "opentelemetry": return normaliseOpenTelemetry(body);
    case "sentry":        return normaliseSentry(body);
  }
}

interface AlertLike {
  status?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  startsAt?: string;
  endsAt?: string;
  generatorURL?: string;
}

function normaliseGrafana(body: unknown): TelemetrySignal[] {
  const alerts = readAlerts(body);
  return alerts.map((a, i) => mapAlertManager("grafana_cloud", a, i, "Grafana"));
}

function normalisePrometheus(body: unknown): TelemetrySignal[] {
  const alerts = readAlerts(body);
  return alerts.map((a, i) => mapAlertManager("prometheus", a, i, "Prometheus"));
}

function readAlerts(body: unknown): AlertLike[] {
  if (body && typeof body === "object" && "alerts" in body && Array.isArray((body as { alerts: unknown }).alerts)) {
    return (body as { alerts: AlertLike[] }).alerts;
  }
  return [];
}

function mapAlertManager(provider: TelemetryProvider, a: AlertLike, idx: number, label: string): TelemetrySignal {
  const labels = a.labels ?? {};
  const ann = a.annotations ?? {};
  const sev = mapSeverityLabel(labels.severity);
  const firing = (a.status ?? "firing").toLowerCase() === "firing";
  return {
    id: `${provider}:${labels.alertname ?? "alert"}:${idx}:${Date.now()}`,
    kind: firing ? "alert_firing" : "alert_resolved",
    severity: sev,
    scope: labels.service ?? labels.instance ?? labels.job ?? "unknown",
    headline: ann.summary ?? labels.alertname ?? `${label} alert`,
    detail: ann.description ?? labels.alertname ?? "",
    firedAt: a.startsAt ?? new Date().toISOString(),
    sourceProvider: provider,
    evidenceRef: a.generatorURL ?? `${provider}:${labels.alertname ?? "alert"}`,
    sourceMode: "live",
    confidence: 0.9,
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

interface DatadogPayload { alert?: { id?: string; title?: string; type?: string; transition?: string; priority?: string; query?: string; link?: string; date?: number; tags?: string[] } }

function normaliseDatadog(body: unknown): TelemetrySignal[] {
  if (!body || typeof body !== "object") return [];
  const dd = body as DatadogPayload;
  if (!dd.alert) return [];
  const a = dd.alert;
  const sev = mapDatadogPriority(a.priority);
  const transition = (a.transition ?? "Triggered").toLowerCase();
  const firing = transition.includes("trigger") || transition.includes("warn") || transition.includes("error");
  return [{
    id: `datadog:${a.id ?? "alert"}:${Date.now()}`,
    kind: firing ? "alert_firing" : "alert_resolved",
    severity: sev,
    scope: (a.tags ?? []).find((t) => t.startsWith("service:")) ?? "datadog",
    headline: a.title ?? "Datadog alert",
    detail: a.query ?? "",
    firedAt: a.date ? new Date(a.date * 1000).toISOString() : new Date().toISOString(),
    sourceProvider: "datadog",
    evidenceRef: a.link ?? `datadog:${a.id ?? "alert"}`,
    sourceMode: "live",
    confidence: 0.9,
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  }];
}

interface SentryIssueDelivery {
  installation?: {uuid?: unknown};
  action?: unknown;
  data?: {issue?: {id?: unknown; status?: unknown; firstSeen?: unknown; level?: unknown; project?: {slug?: unknown}}};
}

function isSentryInstallationId(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

function normaliseSentryIssue(body: SentryIssueDelivery | null): TelemetrySignal[] {
  const issue = body?.data?.issue;
  if (!issue || typeof issue.id !== "string" || !/^\d{1,24}$/.test(issue.id)) return [];
  const action = body?.action;
  const resolved = action === "resolved" && issue.status === "resolved";
  const firing = (action === "created" || action === "unresolved") && issue.status === "unresolved";
  if (!resolved && !firing) return [];
  const firstSeen = issue.firstSeen;
  if (typeof firstSeen !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(firstSeen) || !Number.isFinite(Date.parse(firstSeen))) return [];
  const project = issue.project?.slug;
  const scope = typeof project === "string" && /^[a-z0-9_-]{1,100}$/i.test(project) ? project : "sentry";
  return [{
    id: `sentry:issue:${issue.id}:${action}`,
    kind: resolved ? "alert_resolved" : "alert_firing",
    severity: mapSeverityLabel(typeof issue.level === "string" ? issue.level : undefined),
    scope,
    headline: `Sentry issue ${issue.id} ${action}`,
    detail: "Timestamp records when Sentry first observed the issue.",
    firedAt: new Date(firstSeen).toISOString(),
    sourceProvider: "sentry",
    evidenceRef: `sentry:issue:${issue.id}`,
    sourceMode: "live",
    confidence: 0.85,
    safeNextAction: {label: "Open Risk Queue", href: "/dashboard/risks"},
  }];
}

interface SentryPayload { event?: { event_id?: string; level?: string; message?: string; timestamp?: number; url?: string; tags?: [string, string][] } }

function normaliseSentry(body: unknown): TelemetrySignal[] {
  if (!body || typeof body !== "object") return [];
  const sp = body as SentryPayload;
  if (!sp.event) return [];
  const e = sp.event;
  const sev = mapSeverityLabel(e.level);
  const tags = (e.tags ?? []).reduce<Record<string, string>>((acc, [k, v]) => { acc[k] = v; return acc; }, {});
  return [{
    id: `sentry:${e.event_id ?? "evt"}:${Date.now()}`,
    kind: "trace_error_rate_spike",
    severity: sev,
    scope: tags.environment ?? tags.service ?? "sentry",
    headline: e.message ?? "Sentry event",
    detail: "",
    firedAt: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : new Date().toISOString(),
    sourceProvider: "sentry",
    evidenceRef: e.url ?? `sentry:${e.event_id}`,
    sourceMode: "live",
    confidence: 0.85,
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  }];
}

interface OTelPayload {
  resourceLogs?: unknown[];
  resourceMetrics?: unknown[];
  resourceSpans?: unknown[];
}

function normaliseOpenTelemetry(body: unknown): TelemetrySignal[] {
  if (!body || typeof body !== "object") return [];
  const otel = body as OTelPayload;
  const signals: TelemetrySignal[] = [];
  if (otel.resourceLogs && otel.resourceLogs.length > 0) {
    signals.push(makeOTelSignal("log_anomaly", "Log batch received from OTel collector", `${otel.resourceLogs.length} log resource(s)`));
  }
  if (otel.resourceMetrics && otel.resourceMetrics.length > 0) {
    signals.push(makeOTelSignal("metric_breach", "Metric batch received from OTel collector", `${otel.resourceMetrics.length} metric resource(s)`));
  }
  if (otel.resourceSpans && otel.resourceSpans.length > 0) {
    signals.push(makeOTelSignal("trace_latency_spike", "Trace batch received from OTel collector", `${otel.resourceSpans.length} span resource(s)`));
  }
  return signals;
}

function makeOTelSignal(kind: TelemetrySignalKind, headline: string, detail: string): TelemetrySignal {
  return {
    id: `otel:${kind}:${Date.now()}`,
    kind,
    severity: "info",
    scope: "opentelemetry",
    headline,
    detail,
    firedAt: new Date().toISOString(),
    sourceProvider: "opentelemetry_collector",
    evidenceRef: `otel:${kind}`,
    sourceMode: "live",
    confidence: 0.7,
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

// ---------------------------------------------------------------------------
// Severity mappers
// ---------------------------------------------------------------------------

function mapSeverityLabel(value: string | undefined): TelemetrySeverity {
  if (!value) return "info";
  const v = value.toLowerCase();
  if (v === "critical" || v === "fatal" || v === "page" || v === "sev1" || v === "p1") return "critical";
  if (v === "error" || v === "high" || v === "sev2" || v === "p2") return "high";
  if (v === "warning" || v === "warn" || v === "medium" || v === "sev3" || v === "p3") return "medium";
  if (v === "info" || v === "low" || v === "sev4" || v === "p4") return "low";
  return "info";
}

function mapDatadogPriority(value: string | undefined): TelemetrySeverity {
  if (!value) return "info";
  const v = value.toLowerCase();
  if (v === "p1" || v === "high") return "critical";
  if (v === "p2") return "high";
  if (v === "p3") return "medium";
  if (v === "p4" || v === "low" || v === "normal") return "low";
  return "info";
}
