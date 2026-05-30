/**
 * Scan-complete notifier.
 *
 * Fires an OutboundNotification when a scan finishes, so the operator
 * finds out via Slack / Teams / webhook / email that something landed
 * — without having to open the dashboard. The send is best-effort:
 * never blocks the scan response, never throws into the caller.
 *
 * Severity rolls up from the findings batch:
 *   any critical → critical
 *   any high     → high
 *   any medium   → medium
 *   any low      → low
 *   otherwise    → info (clean scans still fire so operators can
 *                  confirm the cron is running)
 *
 * Dedupe key uses the cloud account id + day, so the */15 cron
 * doesn't spam the channel when two ticks complete within the
 * 10-minute dedupe window.
 */

import "server-only";

import {
  sendOutboundNotification,
  type OutboundSeverity,
} from "./outboundNotificationLane";

interface FindingSummary {
  severity: "info" | "low" | "medium" | "high" | "critical";
}

export interface ScanCompleteNotificationInput {
  tenantId: string;
  provider: "aws" | "azure" | "gcp";
  externalAccountId: string;
  findings: ReadonlyArray<FindingSummary>;
  resourceCount: number;
  trigger: "manual" | "scheduled" | "drift" | "onboarding" | "webhook";
  runId?: string;
}

function rollupSeverity(findings: ReadonlyArray<FindingSummary>): OutboundSeverity {
  if (findings.some((f) => f.severity === "critical")) return "critical";
  if (findings.some((f) => f.severity === "high"))     return "high";
  if (findings.some((f) => f.severity === "medium"))   return "medium";
  if (findings.some((f) => f.severity === "low"))      return "low";
  return "info";
}

function countBySeverity(findings: ReadonlyArray<FindingSummary>) {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<FindingSummary["severity"], number>,
  );
}

export async function notifyScanComplete(input: ScanCompleteNotificationInput): Promise<void> {
  try {
    const severity = rollupSeverity(input.findings);
    const counts = countBySeverity(input.findings);
    const day = new Date().toISOString().slice(0, 10);
    const dedupeKey = `scan_complete:${input.tenantId}:${input.externalAccountId}:${day}`;

    // Notification kind: 'cycle_summary' for clean / informational
    // scans, 'critical_telemetry_signal' when a critical finding
    // lands — operators want a louder signal for the rare case.
    const kind = severity === "critical"
      ? "critical_telemetry_signal" as const
      : "cycle_summary" as const;

    const headline = input.findings.length === 0
      ? `${input.provider.toUpperCase()} scan clean — no findings`
      : `${input.provider.toUpperCase()} scan · ${input.findings.length} finding${input.findings.length === 1 ? "" : "s"}`;

    const lines: string[] = [];
    lines.push(`Account: ${input.externalAccountId}`);
    lines.push(`Resources scanned: ${input.resourceCount}`);
    lines.push(`Trigger: ${input.trigger}`);
    if (input.findings.length > 0) {
      lines.push("");
      const parts: string[] = [];
      if (counts.critical > 0) parts.push(`*${counts.critical} critical*`);
      if (counts.high > 0)     parts.push(`${counts.high} high`);
      if (counts.medium > 0)   parts.push(`${counts.medium} medium`);
      if (counts.low > 0)      parts.push(`${counts.low} low`);
      if (counts.info > 0)     parts.push(`${counts.info} info`);
      lines.push(`Severity: ${parts.join(" · ")}`);
    }

    await sendOutboundNotification({
      dedupeKey,
      kind,
      severity,
      headline,
      body: lines.join("\n"),
      tenantId: input.tenantId,
      safeNextAction: input.findings.length > 0
        ? { label: "Review findings", href: "/dashboard/findings" }
        : { label: "Open dashboard", href: "/dashboard" },
      evidenceRefs: input.runId ? [`run:${input.runId}`] : [],
    });
  } catch (err) {
    console.warn(
      "[scanCompleteNotifier] send failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
