/**
 * Sentry REST pull extractor.
 *
 * Pulls unresolved issues from a Sentry org via the REST API.
 *
 * Endpoint:
 *   GET /api/0/organizations/{org}/issues/?query=is:unresolved&limit=50
 *
 * Hard rules:
 *   - Only runs when SENTRY_PULL_ENABLED + SENTRY_AUTH_TOKEN + SENTRY_ORG set.
 *   - 8s timeout. Cap 50 issues per call.
 *   - Never resolves / merges / deletes an issue.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import type { TelemetrySeverity, TelemetrySignal } from "./telemetryIngestModel";

const DEFAULT_TIMEOUT_MS = 8_000;

export interface SentryPullExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  signals: TelemetrySignal[];
  durationMs: number;
  limitations: string[];
}

interface SentryIssue {
  id?: string;
  shortId?: string;
  title?: string;
  culprit?: string;
  permalink?: string;
  level?: string;
  status?: string;
  lastSeen?: string;
  count?: string | number;
  userCount?: number;
  project?: { slug?: string; name?: string };
}

export async function extractSentryUnresolvedIssues(): Promise<SentryPullExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.sentryPullEnabled) {
    return blocked(start, "SENTRY_PULL_ENABLED is not set — extractor skipped.");
  }
  const token = env.sentryAuthToken;
  const org = env.sentryOrg;
  if (!token || !org) {
    return blocked(start, "SENTRY_AUTH_TOKEN + SENTRY_ORG required.");
  }
  const baseUrl = env.sentryBaseUrl ?? "https://sentry.io";
  const url = `${baseUrl.replace(/\/$/, "")}/api/0/organizations/${encodeURIComponent(org)}/issues/?query=is%3Aunresolved&limit=50`;

  let issues: SentryIssue[];
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }),
      DEFAULT_TIMEOUT_MS,
      "sentry.list_issues",
    );
    if (!res.ok) {
      return blocked(start, `Sentry HTTP ${res.status}.`);
    }
    issues = (await res.json()) as SentryIssue[];
  } catch (err) {
    return blocked(start, `Sentry pull failed: ${redact(errMessage(err))}`);
  }

  const signals: TelemetrySignal[] = issues.map((i) => ({
    id: `sentry:${i.id ?? i.shortId ?? Date.now()}`,
    kind: "trace_error_rate_spike" as const,
    severity: mapSentryLevel(i.level),
    scope: i.project?.slug ?? "sentry",
    headline: i.title ?? "Sentry issue",
    detail: `${i.culprit ?? ""}${i.count ? ` · ${i.count} event(s) · ${i.userCount ?? 0} user(s)` : ""}`,
    firedAt: i.lastSeen ?? new Date().toISOString(),
    sourceProvider: "sentry" as const,
    evidenceRef: i.permalink ?? `sentry:${i.id ?? i.shortId}`,
    sourceMode: "live" as const,
    confidence: 0.88,
    safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
  }));

  return { mode: "live", signals, durationMs: Date.now() - start, limitations: [] };
}

function mapSentryLevel(level: string | undefined): TelemetrySeverity {
  switch ((level ?? "").toLowerCase()) {
    case "fatal":   return "critical";
    case "error":   return "high";
    case "warning": return "medium";
    case "info":    return "low";
    case "debug":   return "info";
    default:        return "medium";
  }
}

function preview(start: number, note: string): SentryPullExtraction {
  return { mode: "preview", signals: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): SentryPullExtraction {
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
