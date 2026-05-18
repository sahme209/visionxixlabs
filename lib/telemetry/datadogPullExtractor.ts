/**
 * Datadog REST pull extractor.
 *
 * Pulls live monitor state via Datadog's REST API. Mirrors the
 * CloudWatch pull pattern but for Datadog.
 *
 * Endpoint: GET /api/v1/monitor?monitor_tags=service:axiom&group_states=alert,warn
 *
 * Authentication is two-header (DD-API-KEY + DD-APPLICATION-KEY).
 *
 * Hard rules:
 *   - Only runs when DATADOG_PULL_ENABLED + both keys are set.
 *   - 8s timeout. Caps at 100 monitors per call.
 *   - Never modifies a monitor.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import type { TelemetrySeverity, TelemetrySignal } from "./telemetryIngestModel";

const DEFAULT_TIMEOUT_MS = 8_000;

export interface DatadogPullExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  signals: TelemetrySignal[];
  durationMs: number;
  limitations: string[];
}

interface DdMonitor {
  id?: number;
  name?: string;
  type?: string;
  query?: string;
  overall_state?: string;
  message?: string;
  priority?: number;
  tags?: string[];
  modified?: string;
}

export async function extractDatadogAlertingMonitors(): Promise<DatadogPullExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.datadogPullEnabled) {
    return blocked(start, "DATADOG_PULL_ENABLED is not set — extractor skipped.");
  }
  const apiKey = env.datadogApiKey;
  const appKey = env.datadogAppKey;
  if (!apiKey || !appKey) {
    return blocked(start, "DATADOG_API_KEY + DATADOG_APPLICATION_KEY required.");
  }

  const site = env.datadogSite ?? "datadoghq.com";
  const url = `https://api.${site}/api/v1/monitor?group_states=alert%2Cwarn&page_size=100`;

  let payload: DdMonitor[];
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: {
          "DD-API-KEY": apiKey,
          "DD-APPLICATION-KEY": appKey,
          Accept: "application/json",
        },
      }),
      DEFAULT_TIMEOUT_MS,
      "datadog.list_monitors",
    );
    if (!res.ok) {
      return blocked(start, `Datadog HTTP ${res.status}.`);
    }
    payload = (await res.json()) as DdMonitor[];
  } catch (err) {
    return blocked(start, `Datadog pull failed: ${redact(errMessage(err))}`);
  }

  const signals: TelemetrySignal[] = payload
    .filter((m) => (m.overall_state ?? "").toLowerCase() === "alert" || (m.overall_state ?? "").toLowerCase() === "warn")
    .map((m) => ({
      id: `datadog:${m.id ?? Date.now()}`,
      kind: "alert_firing" as const,
      severity: mapDdPriority(m.priority, m.overall_state),
      scope: m.tags?.find((t) => t.startsWith("service:")) ?? `datadog:monitor:${m.id ?? "?"}`,
      headline: m.name ?? "Datadog monitor",
      detail: m.message ?? m.query ?? "",
      firedAt: m.modified ?? new Date().toISOString(),
      sourceProvider: "datadog" as const,
      evidenceRef: `https://app.${site}/monitors/${m.id}`,
      sourceMode: "live" as const,
      confidence: 0.92,
      safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
    }));

  return { mode: "live", signals, durationMs: Date.now() - start, limitations: [] };
}

function mapDdPriority(p: number | undefined, overallState: string | undefined): TelemetrySeverity {
  if (p === 1) return "critical";
  if (p === 2) return "high";
  if (p === 3) return "medium";
  if (p === 4 || p === 5) return "low";
  // Fall back to overall_state.
  switch ((overallState ?? "").toLowerCase()) {
    case "alert": return "high";
    case "warn":  return "medium";
    default:      return "info";
  }
}

function preview(start: number, note: string): DatadogPullExtraction {
  return { mode: "preview", signals: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): DatadogPullExtraction {
  return { mode: "blocked", signals: [], durationMs: Date.now() - start, limitations: [note] };
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
