/**
 * Azure Cost Management live extractor.
 *
 * Mirrors the AWS Cost Explorer extractor pattern. Calls the Azure
 * Cost Management REST API directly with a token from
 * `@azure/identity` ClientSecretCredential — no extra SDK dep.
 *
 * Endpoint:
 *   POST https://management.azure.com/subscriptions/{sub}/providers/Microsoft.CostManagement/query?api-version=2023-11-01
 *
 * Two queries (last 30d + prior 30d baseline). Returns confirmed USD
 * (or local currency) totals and a typed spend_spike_7d anomaly
 * when delta ≥ 20%.
 *
 * Hard rules:
 *   - Only runs when AZURE_COST_MGMT_ENABLED is set (per-request cost).
 *   - Returns honest preview/blocked envelope when env / role missing.
 *   - Errors strip likely credential strings before surfacing.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAzureConfig, resolveAzureClientId, resolveAzureClientSecret } from "@/lib/cloud/azure/azureConfig";
import type {
  BillingAnomaly,
  BillingAnomalyKind,
} from "./billingConnectorsModel";

export interface AzureCostManagementExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  confirmedDollarsLast30d: number;
  confirmedDollarsPrev30d: number;
  /** Currency returned by Cost Mgmt (USD / EUR / etc.). */
  currency: string;
  anomalies: BillingAnomaly[];
  durationMs: number;
  limitations: string[];
}

const DEFAULT_TIMEOUT_MS = 15_000;
const SPIKE_THRESHOLD_PCT = 20;

export async function extractAzureCostManagementSpend(): Promise<AzureCostManagementExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.azureCostMgmtEnabled) {
    return blocked(start, "AZURE_COST_MGMT_ENABLED is not set — Cost Management extraction skipped.");
  }
  const azureCfg = getAzureConfig();
  if (azureCfg.mode !== "live") {
    return preview(start, "Azure mode is not live — extractor returned honest preview.");
  }

  const tenantId = env.azureTenantId;
  const subscriptionId = env.azureSubscriptionId;
  if (!tenantId || !subscriptionId) {
    return blocked(start, "AZURE_TENANT_ID + AZURE_SUBSCRIPTION_ID are required.");
  }
  const clientId = resolveAzureClientId();
  const clientSecret = resolveAzureClientSecret();
  if (!clientId || !clientSecret) {
    return blocked(start, "AZURE_CLIENT_ID + AZURE_CLIENT_SECRET are required.");
  }

  // Acquire ARM token.
  let token: string | undefined;
  try {
    const { ClientSecretCredential } = await import("@azure/identity");
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const tokenResponse = await withTimeout(
      credential.getToken("https://management.azure.com/.default"),
      DEFAULT_TIMEOUT_MS,
      "credential.getToken",
    );
    token = tokenResponse?.token;
  } catch (err) {
    return blocked(start, `Azure credential failed: ${redact(errMessage(err))}`);
  }
  if (!token) {
    return blocked(start, "Azure credential returned no token.");
  }

  const now = new Date();
  const t0 = isoMidnight(now);
  const t30 = isoMidnight(daysAgo(now, 30));
  const t60 = isoMidnight(daysAgo(now, 60));
  const url = `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

  const limitations: string[] = [];
  const last30Result = await queryPeriod(url, token, t30, t0, limitations, "last_30");
  const prev30Result = await queryPeriod(url, token, t60, t30, limitations, "prev_30");

  // Anomaly derivation
  const anomalies: BillingAnomaly[] = [];
  if (last30Result.amount > 0 && prev30Result.amount > 0) {
    const deltaPct = ((last30Result.amount - prev30Result.amount) / prev30Result.amount) * 100;
    if (deltaPct >= SPIKE_THRESHOLD_PCT) {
      anomalies.push({
        id: `billing:azure_cost_mgmt:spike_7d:${Date.now()}`,
        kind: "spend_spike_7d" as BillingAnomalyKind,
        severity: deltaPct >= 50 ? "critical" : deltaPct >= 35 ? "high" : "medium",
        scope: "All Azure services",
        headline: `Azure spend up ${deltaPct.toFixed(1)}% vs. prior 30 days`,
        impactSummary: `Confirmed ${last30Result.currency} delta: +${(last30Result.amount - prev30Result.amount).toFixed(2)} over baseline.`,
        deltaUsd: last30Result.currency === "USD" ? last30Result.amount - prev30Result.amount : undefined,
        baselinePeriod: `${t60} → ${t30}`,
        sourceProvider: "azure_cost_management",
        evidenceRef: "azure:cost_management:Query",
        confidence: 0.9,
        safeNextAction: { label: "Open FinOps", href: "/dashboard/finops" },
      });
    }
  }

  return {
    mode: "live",
    confirmedDollarsLast30d: last30Result.amount,
    confirmedDollarsPrev30d: prev30Result.amount,
    currency: last30Result.currency || prev30Result.currency || "USD",
    anomalies,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PeriodResult { amount: number; currency: string }

async function queryPeriod(
  url: string,
  token: string,
  fromIso: string,
  toIso: string,
  limitations: string[],
  label: string,
): Promise<PeriodResult> {
  const body = {
    type: "ActualCost",
    timeframe: "Custom",
    timePeriod: { from: fromIso, to: toIso },
    dataset: {
      granularity: "None",
      aggregation: { totalCost: { name: "PreTaxCost", function: "Sum" } },
    },
  };
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      DEFAULT_TIMEOUT_MS,
      `azure_cost_mgmt.query.${label}`,
    );
    if (!res.ok) {
      limitations.push(`${label} query HTTP ${res.status}.`);
      return { amount: 0, currency: "USD" };
    }
    const json = (await res.json()) as {
      properties?: {
        columns?: { name: string; type: string }[];
        rows?: (string | number)[][];
      };
    };
    return parseCostPayload(json);
  } catch (err) {
    limitations.push(`${label} query failed: ${redact(errMessage(err))}`);
    return { amount: 0, currency: "USD" };
  }
}

function parseCostPayload(json: { properties?: { columns?: { name: string; type: string }[]; rows?: (string | number)[][] } }): PeriodResult {
  const cols = json.properties?.columns ?? [];
  const rows = json.properties?.rows ?? [];
  const costIdx = cols.findIndex((c) => c.name.toLowerCase() === "pretaxcost" || c.name.toLowerCase() === "cost");
  const currencyIdx = cols.findIndex((c) => c.name.toLowerCase() === "currency");
  let amount = 0;
  let currency = "USD";
  for (const row of rows) {
    if (costIdx >= 0) {
      const v = row[costIdx];
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) amount += n;
    }
    if (currencyIdx >= 0 && typeof row[currencyIdx] === "string") {
      currency = String(row[currencyIdx]);
    }
  }
  return { amount, currency };
}

function isoMidnight(d: Date): string {
  return `${d.toISOString().slice(0, 10)}T00:00:00Z`;
}

function daysAgo(now: Date, days: number): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function preview(start: number, note: string): AzureCostManagementExtraction {
  return { mode: "preview", confirmedDollarsLast30d: 0, confirmedDollarsPrev30d: 0, currency: "USD", anomalies: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): AzureCostManagementExtraction {
  return { mode: "blocked", confirmedDollarsLast30d: 0, confirmedDollarsPrev30d: 0, currency: "USD", anomalies: [], durationMs: Date.now() - start, limitations: [note] };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }

function redact(msg: string): string {
  return msg
    .replace(/[A-Za-z0-9+/=]{40,}/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}
