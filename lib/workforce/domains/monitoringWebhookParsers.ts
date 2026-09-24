/**
 * Monitoring webhook payload parsers — Phase 643.
 *
 * Each alerting tool sends a different JSON shape. This module
 * normalizes every provider's webhook into one NormalizedAlert
 * type that downstream code (workload_performance_engineer
 * trigger, persistence, audit) consumes uniformly.
 *
 * Provider documentation references:
 *   · Datadog          https://docs.datadoghq.com/integrations/webhooks/
 *   · Prometheus AM    https://prometheus.io/docs/alerting/latest/configuration/#webhook_config
 *   · PagerDuty        https://developer.pagerduty.com/docs/webhooks-overview
 *   · Grafana          https://grafana.com/docs/grafana/latest/alerting/contact-points/webhook/
 *   · Opsgenie         https://docs.opsgenie.com/docs/webhook-integration
 *   · generic          accepts any JSON; uses well-known keys when present
 *
 * We deliberately keep parsing PERMISSIVE — webhook payloads vary
 * even within the same provider's version history. Missing fields
 * fall through to sensible defaults; we never throw on a parse.
 *
 * Server-only.
 */

import "server-only";

import type { WebhookProvider } from "@/lib/workforce/domains/monitoringWebhookConfig";

export type AlertSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface NormalizedAlert {
  /** Stable id for this alert, suitable as a slug. */
  alertId: string;
  /** Short title for UI surfaces. */
  title: string;
  /** Longer description / message body from the alerting tool. */
  description: string;
  severity: AlertSeverity;
  /** "firing" | "resolved" — pass through when the tool says so. */
  state: "firing" | "resolved" | "unknown";
  /** Service / resource the alert refers to. Best-effort extraction. */
  affectedService: string;
  /** Tags / labels the alerting tool attached. Useful for filtering. */
  tags: ReadonlyArray<string>;
  /** Original raw payload, so the operator can drill into the
   *  source when our parsing misses a field. */
  rawPayloadSummary: string;
}

const DEFAULT: NormalizedAlert = {
  alertId: "",
  title: "(no title)",
  description: "",
  severity: "medium",
  state: "unknown",
  affectedService: "",
  tags: [],
  rawPayloadSummary: "",
};

function s(v: unknown, max = 400): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function toSeverity(raw: unknown): AlertSeverity {
  if (typeof raw !== "string") return "medium";
  const r = raw.toLowerCase();
  if (r === "critical" || r === "p1" || r === "sev1" || r === "emergency") return "critical";
  if (r === "high" || r === "p2" || r === "sev2" || r === "error") return "high";
  if (r === "medium" || r === "warning" || r === "warn" || r === "p3" || r === "sev3") return "medium";
  if (r === "low" || r === "minor" || r === "p4" || r === "sev4") return "low";
  if (r === "info" || r === "informational" || r === "ok" || r === "p5" || r === "sev5") return "info";
  return "medium";
}

function summarize(payload: unknown): string {
  try {
    return JSON.stringify(payload).slice(0, 800);
  } catch {
    return String(payload).slice(0, 800);
  }
}

/**
 * Generic fallback: walk well-known keys ("title", "summary",
 * "alert", "message") for the title; "description" / "details" /
 * "body" for the description; "severity" / "priority" for severity.
 */
function parseGeneric(payload: Record<string, unknown>): NormalizedAlert {
  const title = s(payload.title ?? payload.summary ?? payload.alert ?? payload.subject) || "(no title)";
  const description = s(payload.description ?? payload.details ?? payload.body ?? payload.message, 1200);
  const severity = toSeverity(payload.severity ?? payload.priority ?? payload.level);
  const stateRaw = s(payload.state ?? payload.status);
  const state: NormalizedAlert["state"] =
    stateRaw.toLowerCase() === "resolved" || stateRaw.toLowerCase() === "ok" ? "resolved" :
    stateRaw.toLowerCase() === "firing" || stateRaw.toLowerCase() === "alerting" || stateRaw.toLowerCase() === "triggered" ? "firing" :
    "unknown";
  const affectedService = s(payload.service ?? payload.resource ?? payload.source) || "";
  const tagsRaw = payload.tags ?? payload.labels ?? [];
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((x): x is string => typeof x === "string").slice(0, 20)
    : [];
  return {
    ...DEFAULT,
    alertId: s(payload.id ?? payload.alertId ?? payload.alert_id) || `alert_${Date.now().toString(36)}`,
    title,
    description,
    severity,
    state,
    affectedService,
    tags,
    rawPayloadSummary: summarize(payload),
  };
}

function parseDatadog(payload: Record<string, unknown>): NormalizedAlert {
  // Datadog standard webhook fields: event_id, event_type,
  // alert_query, alert_status, alert_title, alert_metric, body,
  // tags, priority.
  const baseGeneric = parseGeneric(payload);
  return {
    ...baseGeneric,
    alertId: s(payload.event_id) || baseGeneric.alertId,
    title: s(payload.alert_title) || baseGeneric.title,
    description: s(payload.body, 1200) || baseGeneric.description,
    severity: toSeverity(payload.priority ?? payload.alert_status),
    state:
      s(payload.alert_status).toLowerCase() === "ok" ? "resolved" :
      s(payload.alert_status).toLowerCase() === "alert" || s(payload.alert_transition).toLowerCase() === "triggered" ? "firing" :
      baseGeneric.state,
    affectedService: s(payload.alert_metric) || baseGeneric.affectedService,
  };
}

function parsePrometheus(payload: Record<string, unknown>): NormalizedAlert {
  // Prometheus AlertManager sends { alerts: [{ labels, annotations,
  // status, startsAt, endsAt }] }. We summarize the first alert
  // and add the count in description.
  const alerts = Array.isArray(payload.alerts) ? (payload.alerts as unknown[]) : [];
  if (alerts.length === 0) return parseGeneric(payload);
  const first = alerts[0] as Record<string, unknown>;
  const labels = (first.labels && typeof first.labels === "object" ? first.labels : {}) as Record<string, unknown>;
  const annotations = (first.annotations && typeof first.annotations === "object" ? first.annotations : {}) as Record<string, unknown>;
  const title = s(annotations.summary ?? annotations.title ?? labels.alertname) || "(prometheus alert)";
  const description = s(annotations.description ?? annotations.message, 1200) +
    (alerts.length > 1 ? ` · ${alerts.length} alerts in this batch` : "");
  const severity = toSeverity(labels.severity);
  const stateRaw = s(first.status);
  const state: NormalizedAlert["state"] =
    stateRaw === "resolved" ? "resolved" :
    stateRaw === "firing" ? "firing" : "unknown";
  const affectedService = s(labels.service ?? labels.job ?? labels.instance) || "";
  const tags: string[] = [];
  for (const [k, v] of Object.entries(labels)) {
    if (typeof v === "string" && tags.length < 20) tags.push(`${k}=${v}`);
  }
  return {
    ...DEFAULT,
    alertId: s(labels.alertname) ? `${s(labels.alertname)}_${Date.now().toString(36)}` : `pa_${Date.now().toString(36)}`,
    title,
    description,
    severity,
    state,
    affectedService,
    tags,
    rawPayloadSummary: summarize(payload),
  };
}

function parsePagerDuty(payload: Record<string, unknown>): NormalizedAlert {
  const messages = Array.isArray(payload.messages) ? (payload.messages as unknown[]) : [];
  const firstMsg = messages.length > 0 ? (messages[0] as Record<string, unknown>) : payload;
  const incident = (firstMsg.incident ?? firstMsg) as Record<string, unknown>;
  const summary = s(incident.title ?? incident.summary ?? incident.description) || "(pagerduty incident)";
  const urgency = s(incident.urgency).toLowerCase();
  const severity: AlertSeverity = urgency === "high" ? "high" : urgency === "low" ? "low" : "medium";
  const statusRaw = s(incident.status).toLowerCase();
  const state: NormalizedAlert["state"] =
    statusRaw === "resolved" ? "resolved" :
    statusRaw === "triggered" || statusRaw === "acknowledged" ? "firing" : "unknown";
  const service = (incident.service && typeof incident.service === "object" ? incident.service : {}) as Record<string, unknown>;
  const affectedService = s(service.name ?? service.summary) || "";
  return {
    ...DEFAULT,
    alertId: s(incident.id ?? incident.incident_key) || `pd_${Date.now().toString(36)}`,
    title: summary,
    description: s(incident.description, 1200),
    severity,
    state,
    affectedService,
    tags: [],
    rawPayloadSummary: summarize(payload),
  };
}

function parseGrafana(payload: Record<string, unknown>): NormalizedAlert {
  // Grafana legacy: { ruleId, ruleName, state, message, evalMatches }.
  // Grafana unified (v9+): { alerts: [...] } — like Prometheus.
  if (Array.isArray(payload.alerts)) return parsePrometheus(payload);
  const baseGeneric = parseGeneric(payload);
  return {
    ...baseGeneric,
    alertId: s(payload.ruleId) ? `gr_${s(payload.ruleId)}` : baseGeneric.alertId,
    title: s(payload.ruleName) || baseGeneric.title,
    description: s(payload.message, 1200) || baseGeneric.description,
    state:
      s(payload.state).toLowerCase() === "ok" ? "resolved" :
      s(payload.state).toLowerCase() === "alerting" ? "firing" : "unknown",
  };
}

function parseOpsgenie(payload: Record<string, unknown>): NormalizedAlert {
  const alert = (payload.alert && typeof payload.alert === "object" ? payload.alert : payload) as Record<string, unknown>;
  return {
    ...DEFAULT,
    alertId: s(alert.alertId ?? alert.id) || `og_${Date.now().toString(36)}`,
    title: s(alert.message ?? alert.title) || "(opsgenie alert)",
    description: s(alert.description, 1200),
    severity: toSeverity(alert.priority),
    state:
      s(payload.action).toLowerCase() === "close" || s(payload.action).toLowerCase() === "acknowledge" ? "resolved" :
      s(payload.action).toLowerCase() === "create" ? "firing" : "unknown",
    affectedService: s(alert.entity ?? alert.source) || "",
    tags: Array.isArray(alert.tags)
      ? (alert.tags as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 20)
      : [],
    rawPayloadSummary: summarize(payload),
  };
}

export function parseWebhookPayload(
  provider: WebhookProvider,
  payload: unknown,
): NormalizedAlert {
  if (!payload || typeof payload !== "object") return DEFAULT;
  const obj = payload as Record<string, unknown>;
  switch (provider) {
    case "datadog": return parseDatadog(obj);
    case "prometheus_alertmanager": return parsePrometheus(obj);
    case "pagerduty": return parsePagerDuty(obj);
    case "grafana": return parseGrafana(obj);
    case "opsgenie": return parseOpsgenie(obj);
    case "generic":
    default: return parseGeneric(obj);
  }
}
