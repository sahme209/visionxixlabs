/**
 * PagerDuty REST pull extractor.
 *
 * Symmetric to the webhook receiver (46b) — pulls open incidents
 * from the PagerDuty REST API when an operator hasn't wired the
 * webhook chain. Both can run concurrently; the canonical
 * IncidentRecord shape dedupes by externalId.
 *
 * Endpoint: GET /incidents?statuses[]=triggered&statuses[]=acknowledged&limit=50
 *
 * Hard rules:
 *   - Only runs when PAGERDUTY_PULL_ENABLED + PAGERDUTY_API_TOKEN set.
 *   - 8s timeout. Page cap of 50 open incidents per call.
 *   - The extractor never resolves / triggers / acknowledges anything.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import type {
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
} from "./incidentResponseModel";

const DEFAULT_TIMEOUT_MS = 8_000;
const PD_BASE = "https://api.pagerduty.com";

export interface PagerDutyPullExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  records: IncidentRecord[];
  durationMs: number;
  limitations: string[];
}

interface PdIncident {
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
}

interface PdResponse {
  incidents?: PdIncident[];
}

export async function extractPagerDutyOpenIncidents(): Promise<PagerDutyPullExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.pagerDutyPullEnabled) {
    return blocked(start, "PAGERDUTY_PULL_ENABLED is not set — extractor skipped.");
  }
  const token = env.pagerDutyApiToken;
  if (!token) {
    return blocked(start, "PAGERDUTY_API_TOKEN is not set.");
  }

  const url = `${PD_BASE}/incidents?statuses%5B%5D=triggered&statuses%5B%5D=acknowledged&limit=50`;

  let payload: PdResponse;
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: {
          Authorization: `Token token=${token}`,
          Accept: "application/vnd.pagerduty+json;version=2",
        },
      }),
      DEFAULT_TIMEOUT_MS,
      "pagerduty.list_incidents",
    );
    if (!res.ok) {
      return blocked(start, `PagerDuty HTTP ${res.status}.`);
    }
    payload = (await res.json()) as PdResponse;
  } catch (err) {
    return blocked(start, `PagerDuty pull failed: ${redact(errMessage(err))}`);
  }

  const records: IncidentRecord[] = (payload.incidents ?? []).map((inc) => mapPd(inc));
  return { mode: "live", records, durationMs: Date.now() - start, limitations: [] };
}

function mapPd(inc: PdIncident): IncidentRecord {
  const sev: IncidentSeverity = (inc.urgency ?? "").toLowerCase() === "high" ? "p1"
    : (inc.urgency ?? "").toLowerCase() === "low" ? "p3" : "p2";
  const status: IncidentStatus =
    (inc.status ?? "").toLowerCase() === "triggered"    ? "triggered" :
    (inc.status ?? "").toLowerCase() === "acknowledged" ? "acknowledged" :
    (inc.status ?? "").toLowerCase() === "resolved"     ? "resolved" :
    "triggered";
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

function preview(start: number, note: string): PagerDutyPullExtraction {
  return { mode: "preview", records: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): PagerDutyPullExtraction {
  return { mode: "blocked", records: [], durationMs: Date.now() - start, limitations: [note] };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function redact(msg: string): string {
  return msg.replace(/[A-Za-z0-9+/=]{20,}/g, "[redacted]");
}
