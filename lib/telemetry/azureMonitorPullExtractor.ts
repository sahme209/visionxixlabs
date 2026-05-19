/**
 * Azure Monitor REST pull extractor.
 *
 * Pulls "active" Azure Monitor alerts via the AlertsManagement REST API
 * — the canonical "what's firing right now in this subscription?"
 * stream. We avoid adding @azure/arm-monitor (heavy) and instead use
 * a thin REST call signed with the same ClientSecretCredential the
 * other Azure extractors already use.
 *
 * Endpoint:
 *   GET https://management.azure.com/subscriptions/{sub}/providers/
 *       Microsoft.AlertsManagement/alerts
 *       ?api-version=2019-05-05-preview
 *       &monitorCondition=Fired
 *       &alertState=New,Acknowledged
 *
 * Hard rules:
 *   - Only runs when Azure live mode + AZURE_INVENTORY_EXTRACT_ENABLED.
 *   - 10s timeout. Cap 100 alerts.
 *   - Read-only — never resolves an alert.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import {
  getAzureConfig,
  resolveAzureClientId,
  resolveAzureClientSecret,
} from "@/lib/cloud/azure/azureConfig";
import type { TelemetrySeverity, TelemetrySignal } from "./telemetryIngestModel";

const CALL_TIMEOUT_MS = 10_000;
const MAX_ALERTS = 100;

export interface AzureMonitorPullExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  signals: TelemetrySignal[];
  durationMs: number;
  limitations: string[];
}

interface AzureAlertProperties {
  essentials?: {
    alertRule?: string;
    severity?: string;        // "Sev0" .. "Sev4"
    monitorCondition?: string; // "Fired" | "Resolved"
    alertState?: string;
    description?: string;
    targetResource?: string;
    startDateTime?: string;
  };
}

interface AzureAlert {
  id?: string;
  name?: string;
  properties?: AzureAlertProperties;
}

export async function extractAzureMonitorAlerts(): Promise<AzureMonitorPullExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.azureInventoryExtractEnabled) {
    return blocked(start, "AZURE_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getAzureConfig();
  if (cfg.mode !== "live") {
    return preview(start, "Azure mode is not live — extractor returned honest preview.");
  }
  const tenantId = env.azureTenantId;
  const subscriptionId = env.azureSubscriptionId;
  if (!tenantId || !subscriptionId) {
    return blocked(start, "AZURE_TENANT_ID + AZURE_SUBSCRIPTION_ID required.");
  }
  const clientId = resolveAzureClientId();
  const clientSecret = resolveAzureClientSecret();
  if (!clientId || !clientSecret) {
    return blocked(start, "AZURE_CLIENT_ID + AZURE_CLIENT_SECRET required.");
  }

  let token: string | undefined;
  try {
    const { ClientSecretCredential } = await import("@azure/identity");
    const cred = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const t = await cred.getToken("https://management.azure.com/.default");
    token = t?.token;
  } catch (err) {
    return blocked(start, `Azure AAD token failed: ${redact(errMessage(err))}`);
  }
  if (!token) {
    return blocked(start, "Azure AAD produced no management token.");
  }

  const url = `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}/providers/Microsoft.AlertsManagement/alerts?api-version=2019-05-05-preview&monitorCondition=Fired&alertState=New,Acknowledged`;

  let body: { value?: AzureAlert[] };
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }),
      CALL_TIMEOUT_MS,
      "azure.list_alerts",
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return blocked(start, `Azure Monitor HTTP ${res.status}: ${redact(text).slice(0, 200)}`);
    }
    body = (await res.json()) as { value?: AzureAlert[] };
  } catch (err) {
    return blocked(start, `Azure Monitor pull failed: ${redact(errMessage(err))}`);
  }

  const alerts = (body.value ?? []).slice(0, MAX_ALERTS);
  const signals: TelemetrySignal[] = alerts.map((a) => {
    const e = a.properties?.essentials ?? {};
    const scope = e.targetResource ?? a.name ?? `azure_monitor:alert:${a.id ?? "?"}`;
    return {
      id: `azure_monitor:${a.name ?? a.id ?? Date.now()}`,
      kind: "alert_firing" as const,
      severity: mapAzureSeverity(e.severity),
      scope,
      headline: e.alertRule ?? a.name ?? "Azure Monitor alert",
      detail: e.description ?? `State ${e.alertState ?? "?"} · Condition ${e.monitorCondition ?? "?"}`,
      firedAt: e.startDateTime ?? new Date().toISOString(),
      sourceProvider: "azure_monitor" as const,
      evidenceRef: `https://portal.azure.com/#blade/Microsoft_Azure_Monitoring/AlertDetailsBlade/alertId/${encodeURIComponent(a.id ?? "")}`,
      sourceMode: "live" as const,
      confidence: 0.92,
      safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
    };
  });

  return { mode: "live", signals, durationMs: Date.now() - start, limitations: [] };
}

function mapAzureSeverity(sev: string | undefined): TelemetrySeverity {
  switch ((sev ?? "").toLowerCase()) {
    case "sev0": return "critical";
    case "sev1": return "high";
    case "sev2": return "medium";
    case "sev3": return "low";
    case "sev4": return "info";
    default:     return "medium";
  }
}

function preview(start: number, note: string): AzureMonitorPullExtraction {
  return { mode: "preview", signals: [], durationMs: Date.now() - start, limitations: [note] };
}
function blocked(start: number, note: string): AzureMonitorPullExtraction {
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
  return msg.replace(/[A-Za-z0-9+/=]{30,}/g, "[redacted]");
}
