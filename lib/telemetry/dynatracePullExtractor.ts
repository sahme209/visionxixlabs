/**
 * Dynatrace REST pull extractor.
 *
 * Pulls live "problems" (Dynatrace's term for incidents) from the
 * v2/problems endpoint. Filters for problems that are still OPEN.
 *
 * Endpoint:
 *   GET {env}/api/v2/problems?from=now-1h&problemSelector=status("OPEN")
 *   Authorization: Api-Token {token}
 *
 * Hard rules:
 *   - Only runs when DYNATRACE_PULL_ENABLED + env URL + token are set.
 *   - 8s timeout. Caps at 100 problems per call.
 *   - Read-only — never resolves a problem.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import type { TelemetrySeverity, TelemetrySignal } from "./telemetryIngestModel";

const DEFAULT_TIMEOUT_MS = 8_000;

export interface DynatracePullExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  signals: TelemetrySignal[];
  durationMs: number;
  limitations: string[];
}

interface DtProblem {
  problemId?: string;
  displayId?: string;
  title?: string;
  impactLevel?: string;
  severityLevel?: string;
  status?: string;
  startTime?: number;
  affectedEntities?: { name?: string; entityId?: { id?: string; type?: string } }[];
}

export async function extractDynatraceProblems(): Promise<DynatracePullExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.dynatracePullEnabled) {
    return blocked(start, "DYNATRACE_PULL_ENABLED is not set — extractor skipped.");
  }
  const envUrl = env.dynatraceEnvUrl?.replace(/\/+$/, "");
  const token = env.dynatraceApiToken;
  if (!envUrl || !token) {
    return blocked(start, "DYNATRACE_ENV_URL + DYNATRACE_API_TOKEN required.");
  }

  const url = `${envUrl}/api/v2/problems?from=now-1h&problemSelector=status%28%22OPEN%22%29&pageSize=100`;
  let body: { problems?: DtProblem[] };
  try {
    const res = await withTimeout(
      fetch(url, {
        headers: {
          Authorization: `Api-Token ${token}`,
          Accept: "application/json",
        },
      }),
      DEFAULT_TIMEOUT_MS,
      "dynatrace.list_problems",
    );
    if (!res.ok) {
      return blocked(start, `Dynatrace HTTP ${res.status}.`);
    }
    body = (await res.json()) as { problems?: DtProblem[] };
  } catch (err) {
    return blocked(start, `Dynatrace pull failed: ${redact(errMessage(err))}`);
  }

  const problems = body.problems ?? [];
  const signals: TelemetrySignal[] = problems.map((p) => {
    const entity = p.affectedEntities?.[0];
    const scope = entity?.name ?? entity?.entityId?.id ?? `dynatrace:problem:${p.problemId ?? "?"}`;
    return {
      id: `dynatrace:${p.problemId ?? Date.now()}`,
      kind: "alert_firing" as const,
      severity: mapDtSeverity(p.severityLevel, p.impactLevel),
      scope,
      headline: p.title ?? `Dynatrace problem ${p.displayId ?? p.problemId ?? ""}`.trim(),
      detail: `Status ${p.status ?? "OPEN"} · Impact ${p.impactLevel ?? "?"} · Severity ${p.severityLevel ?? "?"}`,
      firedAt: p.startTime ? new Date(p.startTime).toISOString() : new Date().toISOString(),
      sourceProvider: "dynatrace" as const,
      evidenceRef: `${envUrl}/#problems/problemdetails;pid=${p.problemId ?? ""}`,
      sourceMode: "live" as const,
      confidence: 0.93,
      safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
    };
  });

  return { mode: "live", signals, durationMs: Date.now() - start, limitations: [] };
}

function mapDtSeverity(severityLevel: string | undefined, impactLevel: string | undefined): TelemetrySeverity {
  const s = (severityLevel ?? "").toUpperCase();
  if (s === "AVAILABILITY") return "critical";
  if (s === "ERROR") return "high";
  if (s === "PERFORMANCE" || s === "RESOURCE_CONTENTION") return "medium";
  if (s === "INFO") return "info";
  // Fall back to impact.
  const i = (impactLevel ?? "").toUpperCase();
  if (i === "APPLICATION") return "high";
  if (i === "SERVICE") return "medium";
  if (i === "INFRASTRUCTURE") return "low";
  return "medium";
}

function blocked(start: number, note: string): DynatracePullExtraction {
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
