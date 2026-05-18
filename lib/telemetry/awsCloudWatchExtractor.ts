/**
 * AWS CloudWatch alarms live extractor.
 *
 * Pure read-only pull of alarm state. Unlike the webhook receiver
 * (45b) which depends on external systems pushing, this extractor
 * polls. Useful when the operator hasn't wired CloudWatch alarm
 * actions to an SNS → webhook chain but still wants Axiom to know
 * about firing alarms.
 *
 * Endpoint: STSClient → AssumeRole → CloudWatchClient →
 * DescribeAlarms (caps at 100 alarms per call, AWS default).
 *
 * Hard rules:
 *   - Only runs when AWS mode = live + AWS_CLOUDWATCH_PULL_ENABLED.
 *   - 8s per-call timeout.
 *   - Maps StateValue (ALARM / OK / INSUFFICIENT_DATA) into typed
 *     TelemetrySignal alert_firing / alert_resolved literals.
 *   - The extractor never modifies an alarm.
 */

import "server-only";

import {
  CloudWatchClient,
  DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "@/lib/cloud/aws/awsConfig";
import { resolveAwsCredentials } from "@/lib/cloud/aws/awsCredentialResolver";
import type { TelemetrySeverity, TelemetrySignal } from "./telemetryIngestModel";

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_ALARMS = 100;

export interface AwsCloudWatchExtraction {
  mode: "live" | "preview" | "blocked" | "disabled";
  signals: TelemetrySignal[];
  durationMs: number;
  limitations: string[];
}

export async function extractAwsCloudWatchAlarms(): Promise<AwsCloudWatchExtraction> {
  const start = Date.now();
  const env = loadAppEnv();

  if (!env.awsCloudWatchPullEnabled) {
    return blocked(start, "AWS_CLOUDWATCH_PULL_ENABLED is not set — extractor skipped.");
  }
  const awsCfg = getAwsConfig();
  if (awsCfg.mode !== "live") {
    return preview(start, "AWS mode is not live — extractor returned honest preview.");
  }
  const resolved = await resolveAwsCredentials({ sessionLabel: "cw" });
  if (resolved.mode !== "ok") return blocked(start, resolved.reason);
  const region = resolved.region;
  const cw = new CloudWatchClient({ region, credentials: resolved.credentials });

  // Pull all metric alarms (composite alarms left for follow-up).
  let alarms: {
    AlarmName?: string;
    AlarmArn?: string;
    StateValue?: string;
    StateReason?: string;
    StateUpdatedTimestamp?: Date;
    Namespace?: string;
    MetricName?: string;
    Dimensions?: { Name?: string; Value?: string }[];
    AlarmDescription?: string;
  }[] = [];
  try {
    const res = await withTimeout(
      cw.send(new DescribeAlarmsCommand({
        AlarmTypes: ["MetricAlarm"],
        MaxRecords: MAX_ALARMS,
      })),
      DEFAULT_TIMEOUT_MS,
      "cw.describe_alarms",
    );
    alarms = res.MetricAlarms ?? [];
  } catch (err) {
    return blocked(start, `CloudWatch DescribeAlarms failed: ${redact(errMessage(err))}`);
  }

  const signals: TelemetrySignal[] = [];
  for (const a of alarms) {
    const state = (a.StateValue ?? "INSUFFICIENT_DATA").toUpperCase();
    // Skip alarms that are healthy + INSUFFICIENT_DATA — only noise.
    if (state !== "ALARM" && state !== "OK") continue;

    const firing = state === "ALARM";
    const severity = mapSeverity(a.AlarmName, a.AlarmDescription);
    const scope = a.Dimensions?.map((d) => `${d.Name}=${d.Value}`).join(",")
      ?? `${a.Namespace ?? "cloudwatch"}:${a.MetricName ?? "metric"}`;

    signals.push({
      id: `cloudwatch:${a.AlarmArn ?? a.AlarmName ?? "alarm"}:${a.StateUpdatedTimestamp?.toISOString() ?? Date.now()}`,
      kind: firing ? "alert_firing" : "alert_resolved",
      severity,
      scope,
      headline: a.AlarmName ?? "CloudWatch alarm",
      detail: a.StateReason ?? a.AlarmDescription ?? "",
      firedAt: a.StateUpdatedTimestamp?.toISOString() ?? new Date().toISOString(),
      sourceProvider: "aws_cloudwatch",
      evidenceRef: a.AlarmArn ?? `cloudwatch:${a.AlarmName ?? "alarm"}`,
      sourceMode: "live",
      confidence: 0.95,
      safeNextAction: { label: "Open Risk Queue", href: "/dashboard/risks" },
    });
  }

  return {
    mode: "live",
    signals,
    durationMs: Date.now() - start,
    limitations: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapSeverity(name: string | undefined, description: string | undefined): TelemetrySeverity {
  const t = `${name ?? ""} ${description ?? ""}`.toLowerCase();
  if (/\b(p1|sev1|critical|outage|down|paging)\b/.test(t)) return "critical";
  if (/\b(p2|sev2|high|major|warn)\b/.test(t)) return "high";
  if (/\b(p3|sev3|medium)\b/.test(t)) return "medium";
  if (/\b(p4|sev4|low|minor|info)\b/.test(t)) return "low";
  return "medium"; // default — CloudWatch alarms are usually meaningful
}

function preview(start: number, note: string): AwsCloudWatchExtraction {
  return { mode: "preview", signals: [], durationMs: Date.now() - start, limitations: [note] };
}

function blocked(start: number, note: string): AwsCloudWatchExtraction {
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
  return msg
    .replace(/AKIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/ASIA[0-9A-Z]{16}/g, "[redacted]")
    .replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}
