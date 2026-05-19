/**
 * New Relic REST/NerdGraph pull extractor.
 *
 * Pulls live "issues" (NRDB's term for grouped incidents) from the
 * NerdGraph GraphQL endpoint scoped to the configured account id.
 *
 * Endpoint:
 *   POST https://api.newrelic.com/graphql  (US region)
 *   POST https://api.eu.newrelic.com/graphql  (EU region)
 *   Api-Key: <USER_API_KEY>
 *
 * Hard rules:
 *   - Only runs when NEW_RELIC_PULL_ENABLED + user key + account id set.
 *   - 8s timeout. Caps at 100 issues.
 *   - Read-only — never acknowledges or closes an issue.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import type { TelemetrySeverity, TelemetrySignal } from "./telemetryIngestModel";

const DEFAULT_TIMEOUT_MS = 8_000;

export interface NewRelicPullExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  signals: TelemetrySignal[];
  durationMs: number;
  limitations: string[];
}

interface NrIssue {
  issueId?: string;
  title?: string[];
  description?: string[];
  priority?: string;
  state?: string;
  createdAt?: number;
  entityNames?: string[];
  entityGuids?: string[];
  conditionName?: string[];
}

interface NerdGraphResponse {
  data?: {
    actor?: {
      account?: {
        aiIssues?: {
          issues?: {
            issues?: NrIssue[];
          };
        };
      };
    };
  };
  errors?: { message?: string }[];
}

const QUERY = `
query($accountId: Int!) {
  actor {
    account(id: $accountId) {
      aiIssues {
        issues(filter: { states: [ACTIVATED] }) {
          issues {
            issueId
            title
            description
            priority
            state
            createdAt
            entityNames
            entityGuids
            conditionName
          }
        }
      }
    }
  }
}`;

export async function extractNewRelicIssues(): Promise<NewRelicPullExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.newRelicPullEnabled) {
    return blocked(start, "NEW_RELIC_PULL_ENABLED is not set — extractor skipped.");
  }
  const userKey = env.newRelicUserKey;
  const accountIdRaw = env.newRelicAccountId;
  const accountId = accountIdRaw ? Number.parseInt(accountIdRaw, 10) : NaN;
  if (!userKey || !Number.isFinite(accountId)) {
    return blocked(start, "NEW_RELIC_USER_KEY + NEW_RELIC_ACCOUNT_ID required.");
  }
  const host = env.newRelicRegion === "EU" ? "api.eu.newrelic.com" : "api.newrelic.com";
  const url = `https://${host}/graphql`;

  let body: NerdGraphResponse;
  try {
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          "Api-Key": userKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: QUERY, variables: { accountId } }),
      }),
      DEFAULT_TIMEOUT_MS,
      "newrelic.issues",
    );
    if (!res.ok) {
      return blocked(start, `New Relic HTTP ${res.status}.`);
    }
    body = (await res.json()) as NerdGraphResponse;
  } catch (err) {
    return blocked(start, `New Relic pull failed: ${redact(errMessage(err))}`);
  }

  if (body.errors?.length) {
    return blocked(start, `New Relic GraphQL: ${body.errors.map((e) => e.message).filter(Boolean).join("; ")}`);
  }

  const issues = body.data?.actor?.account?.aiIssues?.issues?.issues ?? [];
  const signals: TelemetrySignal[] = issues.slice(0, 100).map((iss) => {
    const title = iss.title?.[0] ?? iss.conditionName?.[0] ?? "New Relic issue";
    const detail = iss.description?.[0] ?? `Priority ${iss.priority ?? "?"} · State ${iss.state ?? "ACTIVATED"}`;
    const scope = iss.entityNames?.[0] ?? `new_relic:issue:${iss.issueId ?? "?"}`;
    return {
      id: `new_relic:${iss.issueId ?? Date.now()}`,
      kind: "alert_firing" as const,
      severity: mapNrPriority(iss.priority),
      scope,
      headline: title,
      detail,
      firedAt: iss.createdAt ? new Date(iss.createdAt).toISOString() : new Date().toISOString(),
      sourceProvider: "new_relic" as const,
      evidenceRef: `https://one.newrelic.com/redirect/issue/${iss.issueId ?? ""}`,
      sourceMode: "live" as const,
      confidence: 0.92,
      safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
    };
  });

  return { mode: "live", signals, durationMs: Date.now() - start, limitations: [] };
}

function mapNrPriority(p: string | undefined): TelemetrySeverity {
  switch ((p ?? "").toUpperCase()) {
    case "CRITICAL": return "critical";
    case "HIGH":     return "high";
    case "MEDIUM":   return "medium";
    case "LOW":      return "low";
    default:         return "medium";
  }
}

function blocked(start: number, note: string): NewRelicPullExtraction {
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
