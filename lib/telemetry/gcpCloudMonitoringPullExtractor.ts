/**
 * GCP Cloud Monitoring REST pull extractor.
 *
 * Pulls active incidents from the Cloud Monitoring v3 API. We list
 * "incidents" via the alertPolicies endpoint chain:
 *   1. List alert policies (so we can attribute each incident to a
 *      named policy).
 *   2. List incidents (open) under the project.
 *
 * Endpoint:
 *   GET https://monitoring.googleapis.com/v3/projects/{project}/alertPolicies
 *   GET https://monitoring.googleapis.com/v3/projects/{project}/incidents
 *       ?filter=state="open"
 *
 * Note: as of 2026-05 some workspaces only expose incident state via
 * the legacy `Monitoring API` — when the call returns 404 we fall back
 * to surfacing policies with `enabled=true` as "warming" signals so the
 * page never goes empty.
 *
 * Hard rules:
 *   - Only runs when GCP live mode + GCP_INVENTORY_EXTRACT_ENABLED.
 *   - 10s per call. Cap 100 incidents.
 *   - Read-only — never closes an incident or mutes a policy.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import {
  getGcpConfig,
  resolveGcpServiceAccountJson,
  resolveGcpPrivateKey,
  resolveGcpClientEmail,
} from "@/lib/cloud/gcp/gcpConfig";
import type { TelemetrySeverity, TelemetrySignal } from "./telemetryIngestModel";

const CALL_TIMEOUT_MS = 10_000;
const MAX_INCIDENTS = 100;

export interface GcpCloudMonitoringPullExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  signals: TelemetrySignal[];
  durationMs: number;
  limitations: string[];
}

interface GcpAlertPolicy {
  name?: string;
  displayName?: string;
  enabled?: boolean;
  severity?: string;
}

interface GcpIncident {
  name?: string;
  policyName?: string;
  resourceName?: string;
  resourceDisplayName?: string;
  state?: string;
  severity?: string;
  startTime?: string;
  summary?: string;
}

interface ServiceAccountKey {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

export async function extractGcpCloudMonitoringIncidents(): Promise<GcpCloudMonitoringPullExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.gcpInventoryExtractEnabled) {
    return blocked(start, "GCP_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getGcpConfig();
  if (cfg.mode !== "live") {
    return preview(start, "GCP mode is not live — extractor returned honest preview.");
  }
  const projectId = env.gcpProjectId;
  if (!projectId) {
    return blocked(start, "GCP_PROJECT_ID required.");
  }

  let key: ServiceAccountKey = {};
  try {
    const json = resolveGcpServiceAccountJson();
    if (json) {
      key = JSON.parse(json) as ServiceAccountKey;
    } else {
      key = {
        client_email: resolveGcpClientEmail(),
        private_key: resolveGcpPrivateKey(),
        project_id: projectId,
      };
    }
  } catch (err) {
    return blocked(start, `GCP credentials parse failed: ${redact(errMessage(err))}`);
  }
  if (!key.client_email || !key.private_key) {
    return blocked(start, "GCP credentials missing client_email or private_key.");
  }

  let token: string | undefined;
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      projectId,
      credentials: { client_email: key.client_email, private_key: key.private_key },
      scopes: ["https://www.googleapis.com/auth/monitoring.read"],
    });
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    token = typeof t === "string" ? t : t?.token ?? undefined;
  } catch (err) {
    return blocked(start, `GoogleAuth init failed: ${redact(errMessage(err))}`);
  }
  if (!token) {
    return blocked(start, "GoogleAuth produced no token for monitoring scope.");
  }

  // Step 1 — alert policies (for display attribution).
  const policiesByName = new Map<string, GcpAlertPolicy>();
  try {
    const url = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/alertPolicies?pageSize=200`;
    const body = await fetchJson<{ alertPolicies?: GcpAlertPolicy[] }>(url, token);
    for (const p of body.alertPolicies ?? []) {
      if (p.name) policiesByName.set(p.name, p);
    }
  } catch (err) {
    // Non-fatal — continue with empty policy map.
    void err;
  }

  // Step 2 — incidents. Cloud Monitoring exposes `incidents` under the
  // project; the canonical filter for "still firing" is state="open".
  let incidents: GcpIncident[] = [];
  try {
    const url = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/incidents?filter=state%3D%22open%22&pageSize=${MAX_INCIDENTS}`;
    const body = await fetchJson<{ incidents?: GcpIncident[] }>(url, token);
    incidents = body.incidents ?? [];
  } catch (err) {
    // 404 → fall back to enabled policies as warming signals.
    if (/HTTP 404/.test(errMessage(err))) {
      const warming: TelemetrySignal[] = Array.from(policiesByName.values())
        .filter((p) => p.enabled)
        .slice(0, MAX_INCIDENTS)
        .map((p, idx) => ({
          id: `gcp_cloud_monitoring:policy:${p.name ?? idx}`,
          kind: "alert_firing" as const,
          severity: "info" as TelemetrySeverity,
          scope: p.displayName ?? p.name ?? "gcp_alert_policy",
          headline: `Policy enabled: ${p.displayName ?? p.name ?? "alert_policy"}`,
          detail: "Cloud Monitoring incidents endpoint returned 404 — surfacing enabled policies instead.",
          firedAt: new Date().toISOString(),
          sourceProvider: "gcp_cloud_monitoring" as const,
          evidenceRef: `https://console.cloud.google.com/monitoring/alerting/policies?project=${projectId}`,
          sourceMode: "live" as const,
          confidence: 0.55,
          safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
        }));
      return {
        mode: "live",
        signals: warming,
        durationMs: Date.now() - start,
        limitations: ["incidents endpoint 404 — falling back to enabled policy listing."],
      };
    }
    return blocked(start, `GCP incidents list failed: ${redact(errMessage(err))}`);
  }

  const signals: TelemetrySignal[] = incidents.slice(0, MAX_INCIDENTS).map((inc) => {
    const policy = inc.policyName ? policiesByName.get(inc.policyName) : undefined;
    return {
      id: `gcp_cloud_monitoring:${inc.name ?? Date.now()}`,
      kind: "alert_firing" as const,
      severity: mapGcpSeverity(inc.severity ?? policy?.severity),
      scope: inc.resourceDisplayName ?? inc.resourceName ?? "gcp_incident",
      headline: inc.summary ?? policy?.displayName ?? "GCP Cloud Monitoring incident",
      detail: `Policy ${policy?.displayName ?? inc.policyName ?? "?"} · State ${inc.state ?? "open"}`,
      firedAt: inc.startTime ?? new Date().toISOString(),
      sourceProvider: "gcp_cloud_monitoring" as const,
      evidenceRef: `https://console.cloud.google.com/monitoring/alerting/incidents?project=${projectId}`,
      sourceMode: "live" as const,
      confidence: 0.9,
      safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
    };
  });

  return { mode: "live", signals, durationMs: Date.now() - start, limitations: [] };
}

function mapGcpSeverity(sev: string | undefined): TelemetrySeverity {
  switch ((sev ?? "").toUpperCase()) {
    case "CRITICAL": return "critical";
    case "ERROR":
    case "HIGH":     return "high";
    case "WARNING":
    case "MEDIUM":   return "medium";
    case "LOW":      return "low";
    case "INFO":     return "info";
    default:         return "medium";
  }
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${redact(text).slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function preview(start: number, note: string): GcpCloudMonitoringPullExtraction {
  return { mode: "preview", signals: [], durationMs: Date.now() - start, limitations: [note] };
}
function blocked(start: number, note: string): GcpCloudMonitoringPullExtraction {
  return { mode: "blocked", signals: [], durationMs: Date.now() - start, limitations: [note] };
}
function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function redact(msg: string): string {
  return msg.replace(/[A-Za-z0-9+/=]{30,}/g, "[redacted]");
}
