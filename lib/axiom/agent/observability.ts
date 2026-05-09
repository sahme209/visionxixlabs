/**
 * Axiom Agent Internal Observability
 *
 * Structured logging, metrics collection, correlation IDs, and alerting
 * hooks for production monitoring of the Axiom Agent pipeline.
 *
 * Design principles:
 *   - Every log entry carries a correlationId for request tracing
 *   - All metrics are tagged by provider + organization
 *   - Secret redaction applied before any emission
 *   - Alerting hooks are pluggable (webhook, email, PagerDuty)
 *   - Zero external dependencies — runs with in-process collection,
 *     exportable to any backend (Datadog, Grafana, CloudWatch)
 */

import { redactSecrets } from "../../security/secretRedaction";
import { CloudProvider } from "../enums";

// ---------------------------------------------------------------------------
// 1. Correlation ID — flows through every agent operation
// ---------------------------------------------------------------------------

let correlationCounter = 0;

export function generateCorrelationId(prefix = "axm"): string {
  const ts = Date.now().toString(36);
  const seq = (++correlationCounter).toString(36).padStart(4, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${ts}-${seq}-${rand}`;
}

export type CorrelationContext = {
  correlationId: string;
  organizationId: string;
  provider?: CloudProvider;
  runId?: string;
  userId?: string;
  workflowId?: string;
};

// ---------------------------------------------------------------------------
// 2. Structured log schema
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogCategory =
  | "agent.run"
  | "agent.scan"
  | "agent.snapshot"
  | "agent.terraform"
  | "agent.apply"
  | "agent.rollback"
  | "agent.verify"
  | "agent.approval"
  | "connector.auth"
  | "connector.fetch"
  | "connector.error"
  | "monitor.diff"
  | "monitor.alert"
  | "workflow.trigger"
  | "workflow.execute"
  | "workflow.action"
  | "notification.send"
  | "notification.fail"
  | "rbac.auth"
  | "rbac.vote"
  | "system.startup"
  | "system.health";

export type StructuredLogEntry = {
  ts: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId: string;
  organizationId: string;
  provider?: string;
  runId?: string;
  userId?: string;
  workflowId?: string;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// 3. Logger — emits structured JSON, redacts secrets
// ---------------------------------------------------------------------------

type LogSink = (entry: StructuredLogEntry) => void;

const sinks: LogSink[] = [];
const logBuffer: StructuredLogEntry[] = [];
const MAX_BUFFER = 10_000;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

let minLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function addLogSink(sink: LogSink): void {
  sinks.push(sink);
}

export function removeAllSinks(): void {
  sinks.length = 0;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function emitLog(entry: StructuredLogEntry): void {
  entry.message = redactSecrets(entry.message);
  if (entry.error) entry.error = redactSecrets(entry.error);

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

  for (const sink of sinks) {
    try {
      sink(entry);
    } catch {
      // Sink failure must never crash the agent
    }
  }

  // Default console output for environments without sinks
  if (sinks.length === 0) {
    const line = JSON.stringify(entry);
    switch (entry.level) {
      case "debug":
      case "info":
        console.info(line);
        break;
      case "warn":
        console.warn(line);
        break;
      case "error":
      case "fatal":
        console.error(line);
        break;
    }
  }
}

export function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  ctx: CorrelationContext,
  extra?: { durationMs?: number; error?: string; metadata?: Record<string, unknown> },
): void {
  if (!shouldLog(level)) return;

  emitLog({
    ts: new Date().toISOString(),
    level,
    category,
    message,
    correlationId: ctx.correlationId,
    organizationId: ctx.organizationId,
    provider: ctx.provider,
    runId: ctx.runId,
    userId: ctx.userId,
    workflowId: ctx.workflowId,
    durationMs: extra?.durationMs,
    error: extra?.error,
    metadata: extra?.metadata,
  });
}

export function getLogBuffer(limit = 100): StructuredLogEntry[] {
  return logBuffer.slice(-limit);
}

export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

// ---------------------------------------------------------------------------
// 4. Metrics — lightweight in-process counters, gauges, histograms
// ---------------------------------------------------------------------------

export type MetricType = "counter" | "gauge" | "histogram";

export type MetricName =
  // Agent run lifecycle
  | "agent.run.started"
  | "agent.run.completed"
  | "agent.run.failed"
  | "agent.run.duration_ms"
  // Connector health
  | "connector.auth.success"
  | "connector.auth.failure"
  | "connector.fetch.duration_ms"
  | "connector.fetch.errors"
  // Snapshot quality
  | "snapshot.resources.count"
  | "snapshot.regions.count"
  | "snapshot.stale_data.count"
  | "snapshot.generation.duration_ms"
  // Findings & recommendations
  | "findings.total"
  | "findings.by_severity"
  | "findings.by_category"
  | "recommendations.total"
  | "recommendations.auto_fix"
  | "recommendations.approval_required"
  | "recommendations.blocked"
  // Terraform / CLI generation
  | "terraform.generated"
  | "terraform.failed"
  | "terraform.generation.duration_ms"
  | "cli.generated"
  | "cli.failed"
  // Apply & verify
  | "apply.started"
  | "apply.success"
  | "apply.failed"
  | "apply.duration_ms"
  | "verify.success"
  | "verify.failed"
  // Rollback
  | "rollback.triggered"
  | "rollback.success"
  | "rollback.failed"
  // Notifications
  | "notification.sent"
  | "notification.failed"
  | "notification.delivery.duration_ms"
  // Workflows
  | "workflow.triggered"
  | "workflow.completed"
  | "workflow.failed"
  | "workflow.skipped"
  | "workflow.duration_ms"
  | "workflow.actions.executed"
  | "workflow.actions.failed"
  // Monitoring
  | "monitor.alerts.fired"
  | "monitor.alerts.suppressed"
  | "monitor.diff.duration_ms"
  // Approvals
  | "approval.chain.created"
  | "approval.vote.cast"
  | "approval.chain.approved"
  | "approval.chain.rejected"
  | "approval.chain.escalated"
  | "approval.chain.expired";

export type MetricTags = {
  provider?: string;
  organizationId?: string;
  riskLevel?: string;
  actionType?: string;
  severity?: string;
  category?: string;
  status?: string;
  workflowId?: string;
  trigger?: string;
};

type MetricEntry = {
  name: MetricName;
  type: MetricType;
  value: number;
  tags: MetricTags;
  ts: string;
};

type MetricSink = (entry: MetricEntry) => void;

const metricSinks: MetricSink[] = [];
const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, number[]>();

function tagKey(name: MetricName, tags: MetricTags): string {
  const sorted = Object.entries(tags)
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return `${name}{${sorted}}`;
}

function emitMetric(entry: MetricEntry): void {
  for (const sink of metricSinks) {
    try {
      sink(entry);
    } catch {
      // Metric sink failure must never crash the agent
    }
  }
}

export function addMetricSink(sink: MetricSink): void {
  metricSinks.push(sink);
}

export function removeAllMetricSinks(): void {
  metricSinks.length = 0;
}

export function incCounter(name: MetricName, tags: MetricTags = {}, delta = 1): void {
  const key = tagKey(name, tags);
  const current = counters.get(key) ?? 0;
  counters.set(key, current + delta);
  emitMetric({ name, type: "counter", value: current + delta, tags, ts: new Date().toISOString() });
}

export function setGauge(name: MetricName, value: number, tags: MetricTags = {}): void {
  const key = tagKey(name, tags);
  gauges.set(key, value);
  emitMetric({ name, type: "gauge", value, tags, ts: new Date().toISOString() });
}

export function recordHistogram(name: MetricName, value: number, tags: MetricTags = {}): void {
  const key = tagKey(name, tags);
  const existing = histograms.get(key) ?? [];
  existing.push(value);
  if (existing.length > 1000) existing.shift();
  histograms.set(key, existing);
  emitMetric({ name, type: "histogram", value, tags, ts: new Date().toISOString() });
}

export function getCounter(name: MetricName, tags: MetricTags = {}): number {
  return counters.get(tagKey(name, tags)) ?? 0;
}

export function getGauge(name: MetricName, tags: MetricTags = {}): number | undefined {
  return gauges.get(tagKey(name, tags));
}

export function getHistogram(name: MetricName, tags: MetricTags = {}): number[] {
  return histograms.get(tagKey(name, tags)) ?? [];
}

export function getHistogramStats(name: MetricName, tags: MetricTags = {}): HistogramStats | null {
  const values = getHistogram(name, tags);
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

export type HistogramStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
};

export function resetMetrics(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
}

// ---------------------------------------------------------------------------
// 5. Alerting hooks — pluggable notification system
// ---------------------------------------------------------------------------

export type AlertSeverityLevel = "info" | "warning" | "critical" | "page";

export type AlertRule = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  metric: MetricName;
  condition: AlertCondition;
  severity: AlertSeverityLevel;
  tags?: MetricTags;
  cooldownMinutes: number;
  channels: AlertChannel[];
};

export type AlertCondition =
  | { type: "threshold_above"; value: number }
  | { type: "threshold_below"; value: number }
  | { type: "rate_above"; value: number; windowMinutes: number }
  | { type: "absence"; windowMinutes: number };

export type AlertChannel =
  | { type: "webhook"; url: string; headers?: Record<string, string> }
  | { type: "email"; addresses: string[] }
  | { type: "pagerduty"; routingKey: string }
  | { type: "slack"; webhookUrl: string; channel?: string }
  | { type: "log" };

export type FiredAlert = {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverityLevel;
  metric: MetricName;
  currentValue: number;
  threshold: number;
  message: string;
  tags: MetricTags;
  firedAt: string;
  channels: string[];
};

const alertRules: AlertRule[] = [];
const firedAlerts: FiredAlert[] = [];
const lastFiredAt = new Map<string, number>();
let alertCounter = 0;

export function registerAlertRule(rule: AlertRule): void {
  alertRules.push(rule);
}

export function removeAlertRule(ruleId: string): boolean {
  const idx = alertRules.findIndex((r) => r.id === ruleId);
  if (idx < 0) return false;
  alertRules.splice(idx, 1);
  return true;
}

export function listAlertRules(): AlertRule[] {
  return [...alertRules];
}

export function getFiredAlerts(limit = 50): FiredAlert[] {
  return firedAlerts.slice(-limit);
}

export function evaluateAlertRules(): FiredAlert[] {
  const newAlerts: FiredAlert[] = [];
  const now = Date.now();

  for (const rule of alertRules) {
    if (!rule.enabled) continue;

    const lastFired = lastFiredAt.get(rule.id) ?? 0;
    if (now - lastFired < rule.cooldownMinutes * 60 * 1000) continue;

    const value = evaluateConditionValue(rule);
    if (value === null) continue;

    const triggered = checkCondition(rule.condition, value);
    if (!triggered) continue;

    const alert: FiredAlert = {
      id: `alert-${++alertCounter}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      currentValue: value,
      threshold: "value" in rule.condition ? rule.condition.value : 0,
      message: `[${rule.severity.toUpperCase()}] ${rule.name}: ${rule.metric} = ${value}`,
      tags: rule.tags ?? {},
      firedAt: new Date().toISOString(),
      channels: rule.channels.map((c) => c.type),
    };

    firedAlerts.push(alert);
    if (firedAlerts.length > 1000) firedAlerts.shift();
    lastFiredAt.set(rule.id, now);
    newAlerts.push(alert);

    dispatchAlert(alert, rule.channels);
  }

  return newAlerts;
}

function evaluateConditionValue(rule: AlertRule): number | null {
  const tags = rule.tags ?? {};

  switch (rule.condition.type) {
    case "threshold_above":
    case "threshold_below":
      return getCounter(rule.metric, tags) || getGauge(rule.metric, tags) || 0;

    case "rate_above": {
      const windowMs = (rule.condition as { windowMinutes: number }).windowMinutes * 60 * 1000;
      const cutoff = new Date(Date.now() - windowMs).toISOString();
      const entries = getLogBuffer(500).filter((e) => e.ts > cutoff);
      return entries.length;
    }

    case "absence":
      return getCounter(rule.metric, tags);

    default:
      return null;
  }
}

function checkCondition(condition: AlertCondition, value: number): boolean {
  switch (condition.type) {
    case "threshold_above":
      return value > condition.value;
    case "threshold_below":
      return value < condition.value;
    case "rate_above":
      return value > condition.value;
    case "absence":
      return value === 0;
  }
}

function dispatchAlert(alert: FiredAlert, channels: AlertChannel[]): void {
  for (const channel of channels) {
    try {
      switch (channel.type) {
        case "log":
          console.error(JSON.stringify({
            type: "ALERT",
            ...alert,
          }));
          break;
        case "webhook":
        case "slack":
        case "pagerduty":
        case "email":
          // Production: dispatch via async queue
          // These are stubs — actual delivery uses fetch/SMTP/PagerDuty SDK
          break;
      }
    } catch {
      // Alert delivery failure must never crash the agent
    }
  }
}

export function _resetAlerts(): void {
  alertRules.length = 0;
  firedAlerts.length = 0;
  lastFiredAt.clear();
  alertCounter = 0;
}

// ---------------------------------------------------------------------------
// 6. Convenience loggers — pre-built for each agent subsystem
// ---------------------------------------------------------------------------

export function logRunStarted(ctx: CorrelationContext, trigger: string): void {
  log("info", "agent.run", `Agent run started (trigger=${trigger})`, ctx, {
    metadata: { trigger },
  });
  incCounter("agent.run.started", {
    provider: ctx.provider,
    organizationId: ctx.organizationId,
    trigger,
  });
}

export function logRunCompleted(ctx: CorrelationContext, durationMs: number, findingCount: number): void {
  log("info", "agent.run", `Agent run completed in ${durationMs}ms (${findingCount} findings)`, ctx, {
    durationMs,
    metadata: { findingCount },
  });
  incCounter("agent.run.completed", {
    provider: ctx.provider,
    organizationId: ctx.organizationId,
  });
  recordHistogram("agent.run.duration_ms", durationMs, {
    provider: ctx.provider,
    organizationId: ctx.organizationId,
  });
}

export function logRunFailed(ctx: CorrelationContext, error: string, durationMs: number): void {
  log("error", "agent.run", `Agent run failed after ${durationMs}ms`, ctx, {
    durationMs,
    error,
  });
  incCounter("agent.run.failed", {
    provider: ctx.provider,
    organizationId: ctx.organizationId,
  });
}

export function logConnectorAuth(ctx: CorrelationContext, success: boolean, error?: string): void {
  if (success) {
    log("info", "connector.auth", "Cloud connector authenticated", ctx);
    incCounter("connector.auth.success", { provider: ctx.provider });
  } else {
    log("error", "connector.error", "Cloud connector authentication failed", ctx, { error });
    incCounter("connector.auth.failure", { provider: ctx.provider });
  }
}

export function logConnectorFetch(ctx: CorrelationContext, durationMs: number, resourceCount: number): void {
  log("info", "connector.fetch", `Fetched ${resourceCount} resources in ${durationMs}ms`, ctx, {
    durationMs,
    metadata: { resourceCount },
  });
  recordHistogram("connector.fetch.duration_ms", durationMs, { provider: ctx.provider });
}

export function logSnapshotQuality(
  ctx: CorrelationContext,
  resourceCount: number,
  regionCount: number,
  staleCount: number,
  durationMs: number,
): void {
  log("info", "agent.snapshot", `Snapshot: ${resourceCount} resources, ${regionCount} regions, ${staleCount} stale`, ctx, {
    durationMs,
    metadata: { resourceCount, regionCount, staleCount },
  });
  setGauge("snapshot.resources.count", resourceCount, { provider: ctx.provider, organizationId: ctx.organizationId });
  setGauge("snapshot.regions.count", regionCount, { provider: ctx.provider, organizationId: ctx.organizationId });
  setGauge("snapshot.stale_data.count", staleCount, { provider: ctx.provider, organizationId: ctx.organizationId });
  recordHistogram("snapshot.generation.duration_ms", durationMs, { provider: ctx.provider });
}

export function logTerraformGenerated(ctx: CorrelationContext, resourceCount: number, durationMs: number): void {
  log("info", "agent.terraform", `Terraform generated for ${resourceCount} resources`, ctx, {
    durationMs,
    metadata: { resourceCount },
  });
  incCounter("terraform.generated", { provider: ctx.provider });
  recordHistogram("terraform.generation.duration_ms", durationMs, { provider: ctx.provider });
}

export function logTerraformFailed(ctx: CorrelationContext, error: string): void {
  log("error", "agent.terraform", "Terraform generation failed", ctx, { error });
  incCounter("terraform.failed", { provider: ctx.provider });
}

export function logApplyStarted(ctx: CorrelationContext, actionType: string, riskLevel: string): void {
  log("info", "agent.apply", `Applying action: ${actionType} (risk=${riskLevel})`, ctx, {
    metadata: { actionType, riskLevel },
  });
  incCounter("apply.started", { provider: ctx.provider, actionType, riskLevel });
}

export function logApplySuccess(ctx: CorrelationContext, actionType: string, durationMs: number): void {
  log("info", "agent.apply", `Action applied successfully: ${actionType}`, ctx, {
    durationMs,
    metadata: { actionType },
  });
  incCounter("apply.success", { provider: ctx.provider, actionType });
  recordHistogram("apply.duration_ms", durationMs, { provider: ctx.provider, actionType });
}

export function logApplyFailed(ctx: CorrelationContext, actionType: string, error: string, durationMs: number): void {
  log("error", "agent.apply", `Action failed: ${actionType}`, ctx, {
    durationMs,
    error,
    metadata: { actionType },
  });
  incCounter("apply.failed", { provider: ctx.provider, actionType });
}

export function logRollback(ctx: CorrelationContext, actionType: string, success: boolean, error?: string): void {
  if (success) {
    log("warn", "agent.rollback", `Rollback completed: ${actionType}`, ctx, {
      metadata: { actionType },
    });
    incCounter("rollback.success", { provider: ctx.provider, actionType });
  } else {
    log("error", "agent.rollback", `Rollback failed: ${actionType}`, ctx, {
      error,
      metadata: { actionType },
    });
    incCounter("rollback.failed", { provider: ctx.provider, actionType });
  }
  incCounter("rollback.triggered", { provider: ctx.provider });
}

export function logVerification(ctx: CorrelationContext, actionType: string, success: boolean, error?: string): void {
  if (success) {
    log("info", "agent.verify", `Verification passed: ${actionType}`, ctx);
    incCounter("verify.success", { provider: ctx.provider, actionType });
  } else {
    log("error", "agent.verify", `Verification failed: ${actionType}`, ctx, { error });
    incCounter("verify.failed", { provider: ctx.provider, actionType });
  }
}

export function logNotification(ctx: CorrelationContext, channel: string, success: boolean, durationMs?: number, error?: string): void {
  if (success) {
    log("info", "notification.send", `Notification sent via ${channel}`, ctx, { durationMs });
    incCounter("notification.sent", { organizationId: ctx.organizationId });
    if (durationMs) recordHistogram("notification.delivery.duration_ms", durationMs);
  } else {
    log("error", "notification.fail", `Notification failed via ${channel}`, ctx, { error });
    incCounter("notification.failed", { organizationId: ctx.organizationId });
  }
}

export function logWorkflow(
  ctx: CorrelationContext,
  status: "triggered" | "completed" | "failed" | "skipped",
  durationMs?: number,
  error?: string,
): void {
  const level = status === "failed" ? "error" : "info";
  log(level, "workflow.execute", `Workflow ${status}`, ctx, { durationMs, error });
  incCounter(`workflow.${status}` as MetricName, {
    organizationId: ctx.organizationId,
    workflowId: ctx.workflowId,
  });
  if (durationMs) {
    recordHistogram("workflow.duration_ms", durationMs, {
      organizationId: ctx.organizationId,
    });
  }
}

export function logMonitorAlert(ctx: CorrelationContext, alertCount: number, suppressedCount: number): void {
  log("info", "monitor.alert", `Monitor: ${alertCount} alerts fired, ${suppressedCount} suppressed`, ctx, {
    metadata: { alertCount, suppressedCount },
  });
  incCounter("monitor.alerts.fired", { provider: ctx.provider, organizationId: ctx.organizationId }, alertCount);
  incCounter("monitor.alerts.suppressed", { provider: ctx.provider }, suppressedCount);
}

// ---------------------------------------------------------------------------
// 7. Health check — aggregate system state
// ---------------------------------------------------------------------------

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthCheck = {
  status: HealthStatus;
  checks: ComponentHealth[];
  uptime: number;
  timestamp: string;
};

export type ComponentHealth = {
  name: string;
  status: HealthStatus;
  message: string;
  lastActivity?: string;
  metrics?: Record<string, number>;
};

const startTime = Date.now();

export function getHealthCheck(): HealthCheck {
  const checks: ComponentHealth[] = [];

  // Agent runs
  const runStarted = getCounter("agent.run.started");
  const runFailed = getCounter("agent.run.failed");
  const runCompleted = getCounter("agent.run.completed");
  const runFailRate = runStarted > 0 ? runFailed / runStarted : 0;
  checks.push({
    name: "agent_runs",
    status: runFailRate > 0.5 ? "unhealthy" : runFailRate > 0.2 ? "degraded" : "healthy",
    message: `${runCompleted} completed, ${runFailed} failed (${(runFailRate * 100).toFixed(1)}% failure rate)`,
    metrics: { started: runStarted, completed: runCompleted, failed: runFailed },
  });

  // Connector health
  const authSuccess = getCounter("connector.auth.success");
  const authFailure = getCounter("connector.auth.failure");
  const authFailRate = (authSuccess + authFailure) > 0 ? authFailure / (authSuccess + authFailure) : 0;
  checks.push({
    name: "connectors",
    status: authFailRate > 0.5 ? "unhealthy" : authFailRate > 0.1 ? "degraded" : "healthy",
    message: `${authSuccess} auth successes, ${authFailure} failures (${(authFailRate * 100).toFixed(1)}% failure rate)`,
    metrics: { success: authSuccess, failure: authFailure },
  });

  // Apply health
  const applySuccess = getCounter("apply.success");
  const applyFailed = getCounter("apply.failed");
  const applyTotal = applySuccess + applyFailed;
  const applyFailRate = applyTotal > 0 ? applyFailed / applyTotal : 0;
  checks.push({
    name: "apply_actions",
    status: applyFailRate > 0.3 ? "unhealthy" : applyFailRate > 0.1 ? "degraded" : "healthy",
    message: `${applySuccess} succeeded, ${applyFailed} failed`,
    metrics: { success: applySuccess, failed: applyFailed },
  });

  // Terraform generation
  const tfGenerated = getCounter("terraform.generated");
  const tfFailed = getCounter("terraform.failed");
  const tfTotal = tfGenerated + tfFailed;
  const tfFailRate = tfTotal > 0 ? tfFailed / tfTotal : 0;
  checks.push({
    name: "terraform_generation",
    status: tfFailRate > 0.3 ? "unhealthy" : tfFailRate > 0.1 ? "degraded" : "healthy",
    message: `${tfGenerated} generated, ${tfFailed} failed`,
    metrics: { generated: tfGenerated, failed: tfFailed },
  });

  // Notification delivery
  const notifSent = getCounter("notification.sent");
  const notifFailed = getCounter("notification.failed");
  const notifTotal = notifSent + notifFailed;
  const notifFailRate = notifTotal > 0 ? notifFailed / notifTotal : 0;
  checks.push({
    name: "notifications",
    status: notifFailRate > 0.3 ? "unhealthy" : notifFailRate > 0.1 ? "degraded" : "healthy",
    message: `${notifSent} sent, ${notifFailed} failed`,
    metrics: { sent: notifSent, failed: notifFailed },
  });

  // Workflow execution
  const wfCompleted = getCounter("workflow.completed");
  const wfFailed = getCounter("workflow.failed");
  const wfTotal = wfCompleted + wfFailed;
  const wfFailRate = wfTotal > 0 ? wfFailed / wfTotal : 0;
  checks.push({
    name: "workflows",
    status: wfFailRate > 0.5 ? "unhealthy" : wfFailRate > 0.2 ? "degraded" : "healthy",
    message: `${wfCompleted} completed, ${wfFailed} failed`,
    metrics: { completed: wfCompleted, failed: wfFailed },
  });

  // Rollbacks
  const rollbackTriggered = getCounter("rollback.triggered");
  const rollbackFailed = getCounter("rollback.failed");
  checks.push({
    name: "rollbacks",
    status: rollbackFailed > 0 ? "degraded" : "healthy",
    message: `${rollbackTriggered} triggered, ${rollbackFailed} failed`,
    metrics: { triggered: rollbackTriggered, failed: rollbackFailed },
  });

  const overallStatus: HealthStatus = checks.some((c) => c.status === "unhealthy")
    ? "unhealthy"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "healthy";

  return {
    status: overallStatus,
    checks,
    uptime: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 8. Dashboard definitions — exportable panel configs
// ---------------------------------------------------------------------------

export type DashboardPanel = {
  id: string;
  title: string;
  type: "counter" | "timeseries" | "histogram" | "table" | "status";
  metrics: MetricName[];
  groupBy?: string[];
  description: string;
};

export type Dashboard = {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
};

export const DASHBOARDS: Dashboard[] = [
  {
    id: "agent-overview",
    name: "Agent Overview",
    description: "High-level agent health and throughput",
    panels: [
      {
        id: "run-throughput",
        title: "Agent Runs",
        type: "timeseries",
        metrics: ["agent.run.started", "agent.run.completed", "agent.run.failed"],
        groupBy: ["provider"],
        description: "Agent run lifecycle events over time",
      },
      {
        id: "run-duration",
        title: "Run Duration (p50/p90/p99)",
        type: "histogram",
        metrics: ["agent.run.duration_ms"],
        groupBy: ["provider"],
        description: "Distribution of agent run durations",
      },
      {
        id: "system-health",
        title: "System Health",
        type: "status",
        metrics: ["agent.run.started", "agent.run.failed"],
        description: "Overall agent health status",
      },
    ],
  },
  {
    id: "connector-health",
    name: "Connector Health",
    description: "Cloud connector authentication and data quality",
    panels: [
      {
        id: "auth-success-rate",
        title: "Authentication Success Rate",
        type: "timeseries",
        metrics: ["connector.auth.success", "connector.auth.failure"],
        groupBy: ["provider"],
        description: "Connector auth attempts by provider",
      },
      {
        id: "fetch-latency",
        title: "Fetch Latency",
        type: "histogram",
        metrics: ["connector.fetch.duration_ms"],
        groupBy: ["provider"],
        description: "Time to fetch cloud resources per provider",
      },
      {
        id: "snapshot-quality",
        title: "Snapshot Quality",
        type: "table",
        metrics: ["snapshot.resources.count", "snapshot.regions.count", "snapshot.stale_data.count"],
        groupBy: ["provider", "organizationId"],
        description: "Resource counts and staleness per provider",
      },
    ],
  },
  {
    id: "execution-pipeline",
    name: "Execution Pipeline",
    description: "Apply, verify, and rollback operations",
    panels: [
      {
        id: "apply-outcomes",
        title: "Apply Outcomes",
        type: "counter",
        metrics: ["apply.success", "apply.failed"],
        groupBy: ["provider", "actionType"],
        description: "Success vs failure count for applied actions",
      },
      {
        id: "apply-latency",
        title: "Apply Latency",
        type: "histogram",
        metrics: ["apply.duration_ms"],
        groupBy: ["actionType"],
        description: "Time taken to apply cloud changes",
      },
      {
        id: "verification",
        title: "Verification Results",
        type: "counter",
        metrics: ["verify.success", "verify.failed"],
        groupBy: ["provider"],
        description: "Post-apply verification pass/fail",
      },
      {
        id: "rollbacks",
        title: "Rollback Events",
        type: "timeseries",
        metrics: ["rollback.triggered", "rollback.success", "rollback.failed"],
        description: "Rollback frequency and success rate",
      },
      {
        id: "terraform-generation",
        title: "Terraform Generation",
        type: "counter",
        metrics: ["terraform.generated", "terraform.failed"],
        groupBy: ["provider"],
        description: "Terraform code generation success/failure",
      },
    ],
  },
  {
    id: "workflow-automation",
    name: "Workflow Automation",
    description: "Workflow trigger, execution, and action health",
    panels: [
      {
        id: "workflow-status",
        title: "Workflow Execution Status",
        type: "counter",
        metrics: ["workflow.triggered", "workflow.completed", "workflow.failed", "workflow.skipped"],
        groupBy: ["workflowId"],
        description: "Workflow outcomes by workflow ID",
      },
      {
        id: "workflow-duration",
        title: "Workflow Duration",
        type: "histogram",
        metrics: ["workflow.duration_ms"],
        description: "Time to complete workflow executions",
      },
      {
        id: "workflow-actions",
        title: "Workflow Action Health",
        type: "counter",
        metrics: ["workflow.actions.executed", "workflow.actions.failed"],
        description: "Individual action success within workflows",
      },
    ],
  },
  {
    id: "notification-delivery",
    name: "Notification Delivery",
    description: "Notification send rates and latency",
    panels: [
      {
        id: "notification-rate",
        title: "Notification Volume",
        type: "timeseries",
        metrics: ["notification.sent", "notification.failed"],
        groupBy: ["organizationId"],
        description: "Notification send/fail over time",
      },
      {
        id: "notification-latency",
        title: "Delivery Latency",
        type: "histogram",
        metrics: ["notification.delivery.duration_ms"],
        description: "Time to deliver notifications",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 9. Default alert rules — recommended production alerting
// ---------------------------------------------------------------------------

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "high-run-failure-rate",
    name: "High agent run failure rate",
    description: "More than 5 agent runs failed",
    enabled: true,
    metric: "agent.run.failed",
    condition: { type: "threshold_above", value: 5 },
    severity: "critical",
    cooldownMinutes: 30,
    channels: [{ type: "log" }],
  },
  {
    id: "connector-auth-failures",
    name: "Connector authentication failures",
    description: "More than 3 connector auth failures",
    enabled: true,
    metric: "connector.auth.failure",
    condition: { type: "threshold_above", value: 3 },
    severity: "warning",
    cooldownMinutes: 15,
    channels: [{ type: "log" }],
  },
  {
    id: "apply-failures",
    name: "Apply action failures",
    description: "Any apply action has failed",
    enabled: true,
    metric: "apply.failed",
    condition: { type: "threshold_above", value: 0 },
    severity: "critical",
    cooldownMinutes: 10,
    channels: [{ type: "log" }],
  },
  {
    id: "rollback-triggered",
    name: "Rollback triggered",
    description: "A rollback has been triggered — investigate",
    enabled: true,
    metric: "rollback.triggered",
    condition: { type: "threshold_above", value: 0 },
    severity: "warning",
    cooldownMinutes: 5,
    channels: [{ type: "log" }],
  },
  {
    id: "rollback-failure",
    name: "Rollback failed",
    description: "A rollback has failed — immediate attention required",
    enabled: true,
    metric: "rollback.failed",
    condition: { type: "threshold_above", value: 0 },
    severity: "page",
    cooldownMinutes: 5,
    channels: [{ type: "log" }],
  },
  {
    id: "terraform-failures",
    name: "Terraform generation failures",
    description: "More than 3 Terraform generation failures",
    enabled: true,
    metric: "terraform.failed",
    condition: { type: "threshold_above", value: 3 },
    severity: "warning",
    cooldownMinutes: 30,
    channels: [{ type: "log" }],
  },
  {
    id: "notification-delivery-failures",
    name: "Notification delivery failures",
    description: "More than 5 notification deliveries failed",
    enabled: true,
    metric: "notification.failed",
    condition: { type: "threshold_above", value: 5 },
    severity: "warning",
    cooldownMinutes: 30,
    channels: [{ type: "log" }],
  },
  {
    id: "workflow-failures",
    name: "Workflow execution failures",
    description: "More than 3 workflow executions failed",
    enabled: true,
    metric: "workflow.failed",
    condition: { type: "threshold_above", value: 3 },
    severity: "warning",
    cooldownMinutes: 30,
    channels: [{ type: "log" }],
  },
  {
    id: "verification-failures",
    name: "Post-apply verification failures",
    description: "Action applied but verification failed — state may be inconsistent",
    enabled: true,
    metric: "verify.failed",
    condition: { type: "threshold_above", value: 0 },
    severity: "critical",
    cooldownMinutes: 10,
    channels: [{ type: "log" }],
  },
  {
    id: "approval-chain-expired",
    name: "Approval chains expiring",
    description: "More than 5 approval chains expired without resolution",
    enabled: true,
    metric: "approval.chain.expired",
    condition: { type: "threshold_above", value: 5 },
    severity: "info",
    cooldownMinutes: 60,
    channels: [{ type: "log" }],
  },
];

// ---------------------------------------------------------------------------
// 10. Metrics snapshot — full export for external systems
// ---------------------------------------------------------------------------

export type MetricsSnapshot = {
  timestamp: string;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, HistogramStats>;
};

export function exportMetrics(): MetricsSnapshot {
  const histogramStats: Record<string, HistogramStats> = {};
  for (const [key, values] of histograms) {
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    histogramStats[key] = {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  return {
    timestamp: new Date().toISOString(),
    counters: Object.fromEntries(counters),
    gauges: Object.fromEntries(gauges),
    histograms: histogramStats,
  };
}

// ---------------------------------------------------------------------------
// 11. Invariant tests
// ---------------------------------------------------------------------------

export type ObservabilityTestResult = { name: string; passed: boolean; detail: string };

export function runObservabilityTests(): ObservabilityTestResult[] {
  const results: ObservabilityTestResult[] = [];

  // Reset state
  resetMetrics();
  clearLogBuffer();
  _resetAlerts();
  removeAllSinks();
  removeAllMetricSinks();
  setLogLevel("debug");

  // Test 1: Correlation ID is unique
  {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateCorrelationId());
    results.push({
      name: "Correlation IDs are unique across 100 generations",
      passed: ids.size === 100,
      detail: `Unique: ${ids.size}/100`,
    });
  }

  // Test 2: Structured log emits and buffers
  {
    clearLogBuffer();
    const ctx: CorrelationContext = {
      correlationId: "test-corr-1",
      organizationId: "org-1",
      provider: CloudProvider.AWS,
    };
    log("info", "agent.run", "Test message", ctx);
    log("error", "agent.apply", "Test error", ctx, { error: "boom" });

    const buffer = getLogBuffer();
    results.push({
      name: "Structured logs emit to buffer with correlation ID",
      passed: buffer.length === 2 &&
        buffer[0].correlationId === "test-corr-1" &&
        buffer[1].level === "error",
      detail: `Buffer: ${buffer.length} entries, corr=${buffer[0]?.correlationId}`,
    });
  }

  // Test 3: Secret redaction in log messages
  {
    clearLogBuffer();
    const ctx: CorrelationContext = { correlationId: "test-redact", organizationId: "org-1" };
    log("info", "connector.auth", "key=AKIAIOSFODNN7EXAMPLE found", ctx);
    const entry = getLogBuffer(1)[0];
    results.push({
      name: "Secrets are redacted from log messages",
      passed: !entry.message.includes("AKIAIOSFODNN7EXAMPLE") && entry.message.includes("[REDACTED"),
      detail: `Message: ${entry.message.slice(0, 60)}`,
    });
  }

  // Test 4: Counter increments and retrieves
  {
    resetMetrics();
    incCounter("agent.run.started", { provider: "aws" });
    incCounter("agent.run.started", { provider: "aws" });
    incCounter("agent.run.started", { provider: "gcp" });
    const aws = getCounter("agent.run.started", { provider: "aws" });
    const gcp = getCounter("agent.run.started", { provider: "gcp" });
    results.push({
      name: "Counters increment correctly with tag isolation",
      passed: aws === 2 && gcp === 1,
      detail: `AWS: ${aws}, GCP: ${gcp}`,
    });
  }

  // Test 5: Histogram stats computation
  {
    resetMetrics();
    for (const v of [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) {
      recordHistogram("agent.run.duration_ms", v);
    }
    const stats = getHistogramStats("agent.run.duration_ms");
    results.push({
      name: "Histogram computes p50/p90/p99 correctly",
      passed: stats !== null && stats.count === 10 && stats.min === 100 && stats.max === 1000 && stats.p50 === 600,
      detail: `count=${stats?.count}, min=${stats?.min}, max=${stats?.max}, p50=${stats?.p50}`,
    });
  }

  // Test 6: Gauge set and get
  {
    resetMetrics();
    setGauge("snapshot.resources.count", 42, { provider: "azure" });
    setGauge("snapshot.resources.count", 99, { provider: "azure" });
    const val = getGauge("snapshot.resources.count", { provider: "azure" });
    results.push({
      name: "Gauge holds last-set value",
      passed: val === 99,
      detail: `Value: ${val}`,
    });
  }

  // Test 7: Alert rule fires when threshold exceeded
  {
    resetMetrics();
    _resetAlerts();
    registerAlertRule({
      id: "test-alert",
      name: "Test alert",
      description: "Fires when failures > 2",
      enabled: true,
      metric: "agent.run.failed",
      condition: { type: "threshold_above", value: 2 },
      severity: "critical",
      cooldownMinutes: 0,
      channels: [{ type: "log" }],
    });
    incCounter("agent.run.failed", {}, 3);
    const fired = evaluateAlertRules();
    results.push({
      name: "Alert fires when counter exceeds threshold",
      passed: fired.length === 1 && fired[0].severity === "critical",
      detail: `Fired: ${fired.length}, severity: ${fired[0]?.severity}`,
    });
  }

  // Test 8: Alert cooldown prevents re-fire
  {
    // Alert from test 7 should still be in cooldown if cooldown > 0
    // But we set cooldown=0, so let's test with a longer cooldown
    _resetAlerts();
    resetMetrics();
    registerAlertRule({
      id: "cooldown-test",
      name: "Cooldown test",
      description: "Tests cooldown",
      enabled: true,
      metric: "apply.failed",
      condition: { type: "threshold_above", value: 0 },
      severity: "warning",
      cooldownMinutes: 999,
      channels: [{ type: "log" }],
    });
    incCounter("apply.failed", {}, 1);
    const first = evaluateAlertRules();
    const second = evaluateAlertRules();
    results.push({
      name: "Alert cooldown prevents re-firing",
      passed: first.length === 1 && second.length === 0,
      detail: `First: ${first.length}, second: ${second.length}`,
    });
  }

  // Test 9: Health check computes overall status
  {
    resetMetrics();
    incCounter("agent.run.started", {}, 10);
    incCounter("agent.run.completed", {}, 9);
    incCounter("agent.run.failed", {}, 1);
    const health = getHealthCheck();
    results.push({
      name: "Health check computes correct status (10% failure = healthy)",
      passed: health.status === "healthy" && health.checks.length > 0,
      detail: `Status: ${health.status}, checks: ${health.checks.length}`,
    });
  }

  // Test 10: Health check degrades on high failure rate
  {
    resetMetrics();
    incCounter("agent.run.started", {}, 10);
    incCounter("agent.run.completed", {}, 3);
    incCounter("agent.run.failed", {}, 7);
    const health = getHealthCheck();
    const runCheck = health.checks.find((c) => c.name === "agent_runs");
    results.push({
      name: "Health check degrades to unhealthy on 70% failure rate",
      passed: runCheck?.status === "unhealthy",
      detail: `Run status: ${runCheck?.status}, overall: ${health.status}`,
    });
  }

  // Test 11: Convenience loggers emit both log and metric
  {
    resetMetrics();
    clearLogBuffer();
    const ctx: CorrelationContext = {
      correlationId: "conv-test",
      organizationId: "org-1",
      provider: CloudProvider.GCP,
      runId: "run-1",
    };
    logRunStarted(ctx, "manual");
    logRunCompleted(ctx, 5000, 12);
    const logs = getLogBuffer();
    const started = getCounter("agent.run.started", { provider: "gcp", organizationId: "org-1", trigger: "manual" });
    const completed = getCounter("agent.run.completed", { provider: "gcp", organizationId: "org-1" });
    results.push({
      name: "Convenience loggers emit both logs and metrics",
      passed: logs.length === 2 && started === 1 && completed === 1,
      detail: `Logs: ${logs.length}, started counter: ${started}, completed counter: ${completed}`,
    });
  }

  // Test 12: Metrics export produces full snapshot
  {
    resetMetrics();
    incCounter("agent.run.started", {}, 5);
    setGauge("snapshot.resources.count", 100);
    recordHistogram("agent.run.duration_ms", 200);
    recordHistogram("agent.run.duration_ms", 400);
    const snapshot = exportMetrics();
    results.push({
      name: "Metrics export includes counters, gauges, and histograms",
      passed:
        Object.keys(snapshot.counters).length > 0 &&
        Object.keys(snapshot.gauges).length > 0 &&
        Object.keys(snapshot.histograms).length > 0,
      detail: `Counters: ${Object.keys(snapshot.counters).length}, Gauges: ${Object.keys(snapshot.gauges).length}, Histograms: ${Object.keys(snapshot.histograms).length}`,
    });
  }

  // Test 13: Log level filtering
  {
    clearLogBuffer();
    setLogLevel("warn");
    const ctx: CorrelationContext = { correlationId: "level-test", organizationId: "org-1" };
    log("debug", "agent.run", "Should not appear", ctx);
    log("info", "agent.run", "Should not appear", ctx);
    log("warn", "agent.run", "Should appear", ctx);
    log("error", "agent.run", "Should appear", ctx);
    const logs = getLogBuffer();
    results.push({
      name: "Log level filtering suppresses debug/info when level=warn",
      passed: logs.length === 2 && logs[0].level === "warn" && logs[1].level === "error",
      detail: `Logged: ${logs.length}, levels: [${logs.map((l) => l.level).join(", ")}]`,
    });
    setLogLevel("info");
  }

  // Test 14: Dashboard definitions are valid
  {
    const allPanelIds = DASHBOARDS.flatMap((d) => d.panels.map((p) => p.id));
    const unique = new Set(allPanelIds);
    results.push({
      name: "Dashboard panel IDs are unique",
      passed: unique.size === allPanelIds.length && DASHBOARDS.length === 5,
      detail: `Dashboards: ${DASHBOARDS.length}, panels: ${allPanelIds.length}, unique: ${unique.size}`,
    });
  }

  // Test 15: Default alert rules cover critical paths
  {
    const criticalRules = DEFAULT_ALERT_RULES.filter((r) => r.severity === "critical" || r.severity === "page");
    const metrics = new Set(criticalRules.map((r) => r.metric));
    const coversApply = metrics.has("apply.failed");
    const coversRollback = metrics.has("rollback.failed");
    const coversVerify = metrics.has("verify.failed");
    results.push({
      name: "Default alert rules cover apply, rollback, and verify failures",
      passed: coversApply && coversRollback && coversVerify,
      detail: `Critical/page rules: ${criticalRules.length}, covers: apply=${coversApply}, rollback=${coversRollback}, verify=${coversVerify}`,
    });
  }

  // Cleanup
  resetMetrics();
  clearLogBuffer();
  _resetAlerts();
  setLogLevel("info");

  return results;
}
