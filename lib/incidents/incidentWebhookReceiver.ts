/**
 * Incident Webhook Receiver.
 *
 * Inbound lane for incident providers (PagerDuty / Opsgenie / Slack /
 * Microsoft Teams). Same shape as the telemetry receiver:
 *
 *   - HMAC-SHA256 verification against INCIDENT_WEBHOOK_SECRET.
 *   - Refuses every request when secret is unset — never auto-accepts.
 *   - Per-provider normaliser maps vendor payload → canonical
 *     IncidentRecord.
 *   - Payloads pass through redactPayload before persistence.
 *   - In-memory ephemeral queue (cap 500) until DATABASE_URL lands.
 *
 * The receiver NEVER pages humans back or auto-resolves the
 * incident in the source system — it only enqueues a typed record
 * the autonomy loop can read.
 */

import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { loadAppEnv } from "@/lib/config/env";
import { redactPayload } from "@/lib/api/redaction";
import type {
  IncidentProvider,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
} from "./incidentResponseModel";

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

interface QueuedIncident extends IncidentRecord { receivedAt: string }
const QUEUE: QueuedIncident[] = [];
const MAX_QUEUE = 500;

export function readIncidentQueue(): QueuedIncident[] {
  return [...QUEUE].reverse();
}

export function clearIncidentQueue(): number {
  const n = QUEUE.length;
  QUEUE.length = 0;
  return n;
}

// ---------------------------------------------------------------------------
// Receiver entry
// ---------------------------------------------------------------------------

export type IncidentReceiverProvider = "pagerduty" | "opsgenie" | "slack" | "teams";

export interface ReceiveIncidentInput {
  provider: IncidentReceiverProvider;
  rawBody: string;
  signatureHeader: string | null;
}

export interface ReceiveIncidentResult {
  ok: boolean;
  status: number;
  enqueued: number;
  reason?: string;
  records: IncidentRecord[];
}

export function receiveIncidentWebhook(input: ReceiveIncidentInput): ReceiveIncidentResult {
  const env = loadAppEnv();
  const secret = env.incidentWebhookSecret;

  if (!secret) {
    return { ok: false, status: 401, enqueued: 0, reason: "secret_not_configured", records: [] };
  }
  if (!input.signatureHeader) {
    return { ok: false, status: 401, enqueued: 0, reason: "missing_signature", records: [] };
  }
  if (!verifyHmac(secret, input.rawBody, input.signatureHeader)) {
    return { ok: false, status: 401, enqueued: 0, reason: "invalid_signature", records: [] };
  }

  let parsed: unknown;
  try { parsed = JSON.parse(input.rawBody); }
  catch { return { ok: false, status: 400, enqueued: 0, reason: "invalid_json", records: [] }; }

  const redacted = redactPayload(parsed);
  const records = normalise(input.provider, redacted);

  if (records.length === 0) {
    return { ok: true, status: 202, enqueued: 0, reason: "no_records_in_payload", records: [] };
  }

  const now = new Date().toISOString();
  for (const r of records) {
    QUEUE.push({ ...r, receivedAt: now });
    if (QUEUE.length > MAX_QUEUE) QUEUE.shift();
  }
  return { ok: true, status: 200, enqueued: records.length, records };
}

// ---------------------------------------------------------------------------
// HMAC
// ---------------------------------------------------------------------------

function verifyHmac(secret: string, body: string, header: string): boolean {
  const provided = header.replace(/^sha256=/i, "").trim();
  const computed = createHmac("sha256", secret).update(body).digest("hex");
  if (provided.length !== computed.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(computed, "hex"));
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Per-provider normalisers
// ---------------------------------------------------------------------------

function normalise(provider: IncidentReceiverProvider, body: unknown): IncidentRecord[] {
  switch (provider) {
    case "pagerduty": return normalisePagerDuty(body);
    case "opsgenie":  return normaliseOpsgenie(body);
    case "slack":     return normaliseSlack(body);
    case "teams":     return normaliseTeams(body);
  }
}

interface PdMessage {
  event?: string;
  incident?: {
    id?: string;
    incident_number?: number;
    title?: string;
    description?: string;
    urgency?: string;
    status?: string;
    created_at?: string;
    resolved_at?: string;
    service?: { summary?: string };
    html_url?: string;
    assignments?: { assignee?: { summary?: string } }[];
  };
  messages?: PdMessage[];
}

function normalisePagerDuty(body: unknown): IncidentRecord[] {
  if (!body || typeof body !== "object") return [];
  const msg = body as PdMessage;
  const messages = msg.messages ?? (msg.incident ? [msg] : []);
  return messages
    .filter((m) => !!m.incident)
    .map((m) => mapPagerDuty(m));
}

function mapPagerDuty(m: PdMessage): IncidentRecord {
  const inc = m.incident!;
  const status = mapPdStatus(inc.status, m.event);
  const sev = mapPdUrgency(inc.urgency);
  const responder = inc.assignments?.[0]?.assignee?.summary;
  return {
    id: `incident:pagerduty:${inc.id ?? inc.incident_number ?? Date.now()}`,
    provider: "pagerduty",
    externalId: String(inc.id ?? inc.incident_number ?? "unknown"),
    title: inc.title ?? `PagerDuty incident #${inc.incident_number ?? "?"}`,
    severity: sev,
    status,
    affectedService: inc.service?.summary,
    triggeredAt: inc.created_at ?? new Date().toISOString(),
    resolvedAt: inc.resolved_at,
    responder: responder ? { id: `responder:${responder}`, name: responder, sourceMode: "live" } : undefined,
    externalUrl: inc.html_url,
    sourceMode: "live",
    summary: inc.description ?? inc.title ?? "PagerDuty incident",
    linkedTelemetrySignalIds: [],
    linkedRiskIds: [],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  };
}

function mapPdStatus(status: string | undefined, event: string | undefined): IncidentStatus {
  const e = (event ?? "").toLowerCase();
  if (e.includes("acknowledge")) return "acknowledged";
  if (e.includes("resolve")) return "resolved";
  switch ((status ?? "").toLowerCase()) {
    case "triggered":    return "triggered";
    case "acknowledged": return "acknowledged";
    case "resolved":     return "resolved";
    default:             return "triggered";
  }
}

function mapPdUrgency(urgency: string | undefined): IncidentSeverity {
  switch ((urgency ?? "").toLowerCase()) {
    case "high": return "p1";
    case "low":  return "p3";
    default:     return "p2";
  }
}

interface OpsgenieAlert {
  alertId?: string;
  alias?: string;
  message?: string;
  description?: string;
  priority?: string;
  source?: string;
  responders?: { name?: string; type?: string }[];
  tags?: string[];
  details?: Record<string, string>;
  webhookUrl?: string;
}

interface OpsgenieWebhook {
  action?: string;
  alert?: OpsgenieAlert;
}

function normaliseOpsgenie(body: unknown): IncidentRecord[] {
  if (!body || typeof body !== "object") return [];
  const wb = body as OpsgenieWebhook;
  if (!wb.alert) return [];
  const a = wb.alert;
  const sev = mapOpsgeniePriority(a.priority);
  const status = mapOpsgenieAction(wb.action);
  const responder = a.responders?.[0]?.name;
  return [{
    id: `incident:opsgenie:${a.alertId ?? a.alias ?? Date.now()}`,
    provider: "opsgenie",
    externalId: String(a.alertId ?? a.alias ?? "unknown"),
    title: a.message ?? "Opsgenie alert",
    severity: sev,
    status,
    affectedService: a.source,
    triggeredAt: new Date().toISOString(),
    responder: responder ? { id: `responder:${responder}`, name: responder, sourceMode: "live" } : undefined,
    externalUrl: a.webhookUrl,
    sourceMode: "live",
    summary: a.description ?? a.message ?? "Opsgenie alert",
    linkedTelemetrySignalIds: [],
    linkedRiskIds: [],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  }];
}

function mapOpsgeniePriority(p: string | undefined): IncidentSeverity {
  switch ((p ?? "").toUpperCase()) {
    case "P1": return "p1";
    case "P2": return "p2";
    case "P3": return "p3";
    case "P4": return "p4";
    case "P5": return "p5";
    default:   return "p3";
  }
}

function mapOpsgenieAction(a: string | undefined): IncidentStatus {
  const v = (a ?? "").toLowerCase();
  if (v === "create" || v === "open") return "triggered";
  if (v === "acknowledge") return "acknowledged";
  if (v === "close" || v === "resolve") return "resolved";
  return "triggered";
}

interface SlackPayload {
  type?: string;
  event?: { text?: string; channel?: string; ts?: string; user?: string };
}

function normaliseSlack(body: unknown): IncidentRecord[] {
  if (!body || typeof body !== "object") return [];
  const sp = body as SlackPayload;
  if (!sp.event?.text) return [];
  return [{
    id: `incident:slack:${sp.event.ts ?? Date.now()}`,
    provider: "slack_alerts",
    externalId: sp.event.ts ?? "unknown",
    title: sp.event.text.slice(0, 120),
    severity: detectSeverityFromText(sp.event.text),
    status: "triggered",
    affectedService: sp.event.channel,
    triggeredAt: sp.event.ts ? new Date(Number(sp.event.ts) * 1000).toISOString() : new Date().toISOString(),
    sourceMode: "live",
    summary: sp.event.text,
    linkedTelemetrySignalIds: [],
    linkedRiskIds: [],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  }];
}

interface TeamsPayload {
  title?: string;
  text?: string;
  themeColor?: string;
  sections?: { activityTitle?: string; activitySubtitle?: string }[];
}

function normaliseTeams(body: unknown): IncidentRecord[] {
  if (!body || typeof body !== "object") return [];
  const tp = body as TeamsPayload;
  if (!tp.title && !tp.text) return [];
  return [{
    id: `incident:teams:${Date.now()}`,
    provider: "microsoft_teams",
    externalId: `teams:${Date.now()}`,
    title: tp.title ?? tp.text!.slice(0, 120),
    severity: detectSeverityFromText(`${tp.title ?? ""} ${tp.text ?? ""}`),
    status: "triggered",
    triggeredAt: new Date().toISOString(),
    sourceMode: "live",
    summary: tp.text ?? tp.title ?? "Teams alert",
    linkedTelemetrySignalIds: [],
    linkedRiskIds: [],
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  }];
}

function detectSeverityFromText(text: string): IncidentSeverity {
  const t = text.toLowerCase();
  if (/\b(p1|sev1|critical|outage|down)\b/.test(t)) return "p1";
  if (/\b(p2|sev2|high|major|degraded)\b/.test(t)) return "p2";
  if (/\b(p3|sev3|medium|warning)\b/.test(t)) return "p3";
  if (/\b(p4|sev4|low|minor)\b/.test(t)) return "p4";
  return "p3";
}

// Map IncidentReceiverProvider → canonical IncidentProvider for the model
export function toIncidentProvider(receiver: IncidentReceiverProvider): IncidentProvider {
  switch (receiver) {
    case "pagerduty": return "pagerduty";
    case "opsgenie":  return "opsgenie";
    case "slack":     return "slack_alerts";
    case "teams":     return "microsoft_teams";
  }
}
