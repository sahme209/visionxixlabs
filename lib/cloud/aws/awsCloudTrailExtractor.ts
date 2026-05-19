/**
 * AWS CloudTrail event tail extractor.
 *
 * Pulls the most recent management-plane events from CloudTrail
 * (LookupEvents) — the canonical "what did the account just do?"
 * audit feed. Adds light classification on top of the raw event:
 *
 *   • severity   — heuristic ranking driven by event name + outcome
 *                  (root-user activity, IAM key creation, deletions,
 *                  ConsoleLogin Failure, security-group ingress add).
 *   • category   — "iam", "compute", "storage", "network", "security",
 *                  "billing", "console_login", "other".
 *   • outcome    — "success" | "failure" | "unknown" derived from the
 *                  presence of errorCode / errorMessage in the raw
 *                  CloudTrailEvent JSON.
 *
 * Why this matters: every "where did that change come from?" question
 * gets answered from CloudTrail. We surface a thin, typed window into
 * the last hour of activity so the dashboard and autonomy reasoner can
 * react in real time.
 *
 * Hard rules:
 *   - Read-only.
 *   - 12s overall timeout. Hard cap of 200 events returned.
 *   - Per-call failures fall back to a blocked envelope. No fabricated
 *     events.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "./awsConfig";
import { resolveAwsCredentials } from "./awsCredentialResolver";

const CALL_TIMEOUT_MS = 12_000;
const DEFAULT_LOOKBACK_MINUTES = 60;
const MAX_EVENTS = 200;

export type CloudTrailSeverity = "info" | "low" | "medium" | "high" | "critical";
export type CloudTrailCategory =
  | "iam"
  | "compute"
  | "storage"
  | "network"
  | "security"
  | "billing"
  | "console_login"
  | "other";
export type CloudTrailOutcome = "success" | "failure" | "unknown";
export type CloudTrailMode = "live" | "preview" | "blocked" | "disabled";

export interface CloudTrailEventSummary {
  /** Unique event id from CloudTrail. */
  eventId: string;
  eventName: string;
  eventTime?: string;
  eventSource?: string;
  username?: string;
  region?: string;
  userType?: string;
  /** True when CloudTrail flags this as the root user. */
  rootUser: boolean;
  outcome: CloudTrailOutcome;
  severity: CloudTrailSeverity;
  category: CloudTrailCategory;
  /** Short error string when outcome === "failure". */
  errorCode?: string;
}

export interface CloudTrailExtraction {
  mode: CloudTrailMode;
  region?: string;
  lookbackMinutes: number;
  total: number;
  failureCount: number;
  highOrCriticalCount: number;
  rootUserCount: number;
  events: CloudTrailEventSummary[];
  durationMs: number;
  limitations: string[];
}

export async function extractCloudTrailEvents(opts?: { lookbackMinutes?: number }): Promise<CloudTrailExtraction> {
  const start = Date.now();
  const env = loadAppEnv();
  const lookbackMinutes = clamp(opts?.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES, 5, 24 * 60);

  if (!env.awsInventoryExtractEnabled) {
    return blocked(start, lookbackMinutes, "AWS_INVENTORY_EXTRACT_ENABLED is not set — extractor skipped.");
  }
  const cfg = getAwsConfig();
  if (cfg.mode !== "live") {
    return preview(start, lookbackMinutes, "AWS mode is not live — extractor returned honest preview.");
  }

  const resolved = await resolveAwsCredentials({ sessionLabel: "cloudtrail" });
  if (resolved.mode !== "ok") {
    return blocked(start, lookbackMinutes, resolved.reason);
  }

  let CloudTrailClient: typeof import("@aws-sdk/client-cloudtrail").CloudTrailClient;
  let LookupEventsCommand: typeof import("@aws-sdk/client-cloudtrail").LookupEventsCommand;
  try {
    const mod = await import("@aws-sdk/client-cloudtrail");
    CloudTrailClient = mod.CloudTrailClient;
    LookupEventsCommand = mod.LookupEventsCommand;
  } catch (err) {
    return blocked(start, lookbackMinutes, `CloudTrail SDK import failed: ${redact(errMessage(err))}`);
  }

  const client = new CloudTrailClient({
    region: resolved.region,
    credentials: resolved.credentials,
  });

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - lookbackMinutes * 60 * 1000);

  const collected: CloudTrailEventSummary[] = [];
  const limitations: string[] = [];
  let nextToken: string | undefined;

  try {
    while (collected.length < MAX_EVENTS) {
      const resp = await withTimeout(
        client.send(new LookupEventsCommand({
          StartTime: startTime,
          EndTime: endTime,
          MaxResults: 50,
          NextToken: nextToken,
        })),
        CALL_TIMEOUT_MS,
        "cloudtrail.lookup_events",
      );
      const events = resp.Events ?? [];
      for (const e of events) {
        const parsed = parseRawEvent(e.CloudTrailEvent);
        const outcome: CloudTrailOutcome = parsed.errorCode || parsed.errorMessage
          ? "failure"
          : parsed.eventVersion
            ? "success"
            : "unknown";
        collected.push({
          eventId: e.EventId ?? `unknown-${collected.length}`,
          eventName: e.EventName ?? "unknown",
          eventTime: e.EventTime?.toISOString(),
          eventSource: e.EventSource,
          username: e.Username,
          region: parsed.awsRegion ?? resolved.region,
          userType: parsed.userIdentity?.type,
          rootUser: parsed.userIdentity?.type === "Root",
          outcome,
          severity: classifySeverity(e.EventName, outcome, parsed.userIdentity?.type),
          category: classifyCategory(e.EventName, e.EventSource),
          errorCode: parsed.errorCode,
        });
        if (collected.length >= MAX_EVENTS) break;
      }
      nextToken = resp.NextToken;
      if (!nextToken) break;
      if (Date.now() - start > CALL_TIMEOUT_MS * 1.5) {
        limitations.push("Time budget reached — partial event window.");
        break;
      }
    }
  } catch (err) {
    return blocked(start, lookbackMinutes, `CloudTrail LookupEvents failed: ${redact(errMessage(err))}`);
  }

  collected.sort((a, b) => (b.eventTime ?? "").localeCompare(a.eventTime ?? ""));

  return {
    mode: "live",
    region: resolved.region,
    lookbackMinutes,
    total: collected.length,
    failureCount: collected.filter((e) => e.outcome === "failure").length,
    highOrCriticalCount: collected.filter((e) => e.severity === "high" || e.severity === "critical").length,
    rootUserCount: collected.filter((e) => e.rootUser).length,
    events: collected,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const HIGH_SEVERITY_NAMES = new Set([
  "DeleteBucket",
  "DeleteUser",
  "DeleteRole",
  "DeletePolicy",
  "DeleteAccessKey",
  "DeleteTrail",
  "StopLogging",
  "PutBucketAcl",
  "PutBucketPublicAccessBlock",
  "AuthorizeSecurityGroupIngress",
  "DisableKey",
  "ScheduleKeyDeletion",
  "DeleteDBInstance",
  "TerminateInstances",
]);

const CRITICAL_SEVERITY_NAMES = new Set([
  "ConsoleLogin",
  "CreateAccessKey",
  "CreateUser",
  "AttachUserPolicy",
  "AttachRolePolicy",
  "PutUserPolicy",
  "PutRolePolicy",
]);

function classifySeverity(name: string | undefined, outcome: CloudTrailOutcome, userType: string | undefined): CloudTrailSeverity {
  if (!name) return "info";
  // Root user activity is always at least high.
  if (userType === "Root") return outcome === "failure" ? "high" : "critical";
  if (outcome === "failure" && name === "ConsoleLogin") return "high";
  if (CRITICAL_SEVERITY_NAMES.has(name)) return outcome === "failure" ? "medium" : "critical";
  if (HIGH_SEVERITY_NAMES.has(name)) return outcome === "failure" ? "medium" : "high";
  if (outcome === "failure") return "low";
  return "info";
}

function classifyCategory(name: string | undefined, source: string | undefined): CloudTrailCategory {
  const n = name ?? "";
  const s = source ?? "";
  if (n === "ConsoleLogin") return "console_login";
  if (s.startsWith("iam.") || /User|Role|Policy|AccessKey/.test(n)) return "iam";
  if (s.startsWith("ec2.") || /Instance|Vpc|Subnet|Volume|Snapshot/.test(n)) return "compute";
  if (s.startsWith("s3.") || /Bucket|Object/.test(n)) return "storage";
  if (s.startsWith("elasticloadbalancing.") || /SecurityGroup|NetworkAcl|RouteTable/.test(n)) return "network";
  if (s.startsWith("kms.") || s.startsWith("guardduty.") || /Trail|Detector|Key/.test(n)) return "security";
  if (s.startsWith("ce.") || s.startsWith("budgets.") || s.startsWith("organizations.")) return "billing";
  return "other";
}

interface ParsedRawEvent {
  eventVersion?: string;
  errorCode?: string;
  errorMessage?: string;
  awsRegion?: string;
  userIdentity?: { type?: string; userName?: string };
}

function parseRawEvent(raw: string | undefined): ParsedRawEvent {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as ParsedRawEvent;
    return obj ?? {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function preview(start: number, lookbackMinutes: number, note: string): CloudTrailExtraction {
  return {
    mode: "preview",
    lookbackMinutes,
    total: 0,
    failureCount: 0,
    highOrCriticalCount: 0,
    rootUserCount: 0,
    events: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}
function blocked(start: number, lookbackMinutes: number, note: string): CloudTrailExtraction {
  return {
    mode: "blocked",
    lookbackMinutes,
    total: 0,
    failureCount: 0,
    highOrCriticalCount: 0,
    rootUserCount: 0,
    events: [],
    durationMs: Date.now() - start,
    limitations: [note],
  };
}
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function redact(msg: string): string {
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}
