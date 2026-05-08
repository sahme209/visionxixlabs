import type { AgentRunResult } from "../agent/types";
import type { ScanDiff, ScheduledRunNotification } from "./types";
import { CLOUD_PROVIDER_LABELS } from "../enums";
import type { CloudProvider } from "../cloudSnapshot";

// ---------------------------------------------------------------------------
// Notification builders — produce structured payloads from scan results
// ---------------------------------------------------------------------------

type ScheduleContext = {
  id: string;
  organizationId: string;
  cloudAccount: {
    provider: string;
    externalAccountId: string;
    organizationId: string;
  };
};

function providerLabel(p: string): string {
  return CLOUD_PROVIDER_LABELS[p as CloudProvider] ?? p.toUpperCase();
}

function fmtSavings(n: number): string {
  return `$${Math.abs(n).toLocaleString()}`;
}

export const buildNotifications = {
  // ---- From a scan diff — produces 0-N notifications based on what changed ----
  fromDiff(
    schedule: ScheduleContext,
    run: AgentRunResult,
    diff: ScanDiff | null,
  ): ScheduledRunNotification[] {
    const notifications: ScheduledRunNotification[] = [];
    const provider = providerLabel(schedule.cloudAccount.provider);
    const acctId = schedule.cloudAccount.externalAccountId;

    if (!diff) {
      if (run.findingCount > 0) {
        notifications.push({
          type: "scan_diff",
          organizationId: schedule.organizationId,
          userId: null,
          runId: run.runId,
          scheduledRunId: schedule.id,
          title: `${provider} scan complete — ${run.findingCount} finding${run.findingCount !== 1 ? "s" : ""}`,
          body: run.summary,
          data: {
            provider: schedule.cloudAccount.provider,
            accountId: acctId,
            diff: null,
            runSummary: run.summary,
          },
        });
      }
      return notifications;
    }

    if (!diff.isSignificant) return notifications;

    // Always emit a summary notification for significant changes
    notifications.push({
      type: "scan_diff",
      organizationId: schedule.organizationId,
      userId: null,
      runId: run.runId,
      scheduledRunId: schedule.id,
      title: `${provider} (${acctId}) — ${diff.summary}`,
      body: buildDiffBody(diff, provider),
      data: {
        provider: schedule.cloudAccount.provider,
        accountId: acctId,
        diff,
        runSummary: run.summary,
      },
    });

    // High-risk alert — separate notification for urgency
    if (diff.newHighRiskCount > 0) {
      notifications.push({
        type: "new_high_risk",
        organizationId: schedule.organizationId,
        userId: null,
        runId: run.runId,
        scheduledRunId: schedule.id,
        title: `${diff.newHighRiskCount} new high-risk issue${diff.newHighRiskCount !== 1 ? "s" : ""} in ${provider}`,
        body: buildHighRiskBody(diff),
        data: {
          provider: schedule.cloudAccount.provider,
          accountId: acctId,
          diff,
          runSummary: run.summary,
        },
      });
    }

    // Savings increase notification
    if (diff.savingsDelta.high > 100) {
      notifications.push({
        type: "savings_increased",
        organizationId: schedule.organizationId,
        userId: null,
        runId: run.runId,
        scheduledRunId: schedule.id,
        title: `${fmtSavings(diff.savingsDelta.high)}/year more savings found in ${provider}`,
        body: `New cost optimization opportunities worth ${fmtSavings(diff.savingsDelta.high)}/year have been identified. Review the latest scan for details.`,
        data: {
          provider: schedule.cloudAccount.provider,
          accountId: acctId,
          diff,
          runSummary: run.summary,
        },
      });
    }

    // Resolved risks — good news notification
    if (diff.resolvedFindings.length > 0) {
      const highResolved = diff.resolvedFindings.filter(
        (f) => f.severity === "high" || f.severity === "critical",
      );
      if (highResolved.length > 0) {
        notifications.push({
          type: "risk_resolved",
          organizationId: schedule.organizationId,
          userId: null,
          runId: run.runId,
          scheduledRunId: schedule.id,
          title: `${highResolved.length} risk${highResolved.length !== 1 ? "s" : ""} resolved in ${provider}`,
          body: `The following issue${highResolved.length !== 1 ? "s are" : " is"} no longer detected:\n${highResolved.map((f) => `• ${f.title}`).join("\n")}`,
          data: {
            provider: schedule.cloudAccount.provider,
            accountId: acctId,
            diff,
            runSummary: run.summary,
          },
        });
      }
    }

    return notifications;
  },

  // ---- Scan failure notification ----
  scanFailed(
    schedule: ScheduleContext,
    run: AgentRunResult,
  ): ScheduledRunNotification {
    const provider = providerLabel(schedule.cloudAccount.provider);
    return {
      type: "scan_failed",
      organizationId: schedule.organizationId,
      userId: null,
      runId: run.runId,
      scheduledRunId: schedule.id,
      title: `Scheduled ${provider} scan failed`,
      body: `The scheduled scan for ${provider} (${schedule.cloudAccount.externalAccountId}) failed: ${run.error ?? "unknown error"}. Check your cloud connector credentials.`,
      data: {
        provider: schedule.cloudAccount.provider,
        accountId: schedule.cloudAccount.externalAccountId,
        diff: null,
        runSummary: run.summary,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Body builders — detailed multi-line summaries
// ---------------------------------------------------------------------------

function buildDiffBody(diff: ScanDiff, provider: string): string {
  const lines: string[] = [diff.summary, ""];

  if (diff.newFindings.length > 0) {
    lines.push(`New findings (${diff.newFindings.length}):`);
    for (const f of diff.newFindings.slice(0, 5)) {
      const savings = f.yearlyHigh > 0 ? ` — ${fmtSavings(f.yearlyHigh)}/yr` : "";
      lines.push(`• ${f.title} (${f.severity})${savings}`);
    }
    if (diff.newFindings.length > 5) {
      lines.push(`  …and ${diff.newFindings.length - 5} more`);
    }
    lines.push("");
  }

  if (diff.resolvedFindings.length > 0) {
    lines.push(`Resolved (${diff.resolvedFindings.length}):`);
    for (const f of diff.resolvedFindings.slice(0, 5)) {
      lines.push(`• ${f.title}`);
    }
    lines.push("");
  }

  lines.push(`Review the full results in your ${provider} dashboard.`);
  return lines.join("\n");
}

function buildHighRiskBody(diff: ScanDiff): string {
  const highRisk = diff.newFindings.filter(
    (f) => f.severity === "high" || f.severity === "critical",
  );

  const lines: string[] = [
    `${highRisk.length} new high-severity issue${highRisk.length !== 1 ? "s" : ""} detected:`,
    "",
  ];

  for (const f of highRisk) {
    const savings = f.yearlyHigh > 0 ? ` — ${fmtSavings(f.yearlyHigh)}/yr potential savings` : "";
    lines.push(`• ${f.title} (${f.region})${savings}`);
  }

  lines.push("");
  lines.push("These require your attention. No changes were made automatically.");
  return lines.join("\n");
}
