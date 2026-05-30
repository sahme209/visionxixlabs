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
 * Dedupe key uses the cloud account id + day, so the every-15-minute
 * cron doesn't spam the channel when two ticks complete within the
 * 10-minute dedupe window.
 */

import "server-only";

import {
  sendOutboundNotification,
  type OutboundSeverity,
} from "./outboundNotificationLane";
import { prisma } from "@/lib/db";

type Severity = "info" | "low" | "medium" | "high" | "critical";

const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0, low: 1, medium: 2, high: 3, critical: 4,
};

interface TenantPrefs {
  slackWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
  emailDigestTo: string | null;
  severityFloor: Severity;
}

async function loadTenantPrefs(tenantId: string): Promise<TenantPrefs | null> {
  // Best-effort lookup. The notifier should NEVER block on this —
  // env-routing keeps working if the read fails.
  try {
    // The prefs live on the org's cloud-operator Lead. We can't
    // reverse the workspace hash directly; instead scan recent
    // cloud-operator Leads and look up the linked user's email
    // separately (Lead has no `user` Prisma relation defined).
    const { deriveWorkspaceIdFromEmail } = await import("@/lib/auth/workspaceId");
    const leads = await prisma.lead.findMany({
      where: { source: "cloud-operator", userId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { userId: true, fullPayload: true },
    });
    const userIds = leads
      .map((l) => l.userId)
      .filter((u): u is string => typeof u === "string");
    if (userIds.length === 0) return null;
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true },
    });
    const emailByUserId = new Map(users.map((u) => [u.id, u.email]));
    for (const lead of leads) {
      const userEmail = lead.userId ? emailByUserId.get(lead.userId) : null;
      if (!userEmail) continue;
      const derived = deriveWorkspaceIdFromEmail(userEmail.toLowerCase());
      if (derived !== tenantId) continue;
      const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
      const stored = (payload.notifications as Partial<TenantPrefs> | undefined) ?? {};
      return {
        slackWebhookUrl: typeof stored.slackWebhookUrl === "string" ? stored.slackWebhookUrl : null,
        teamsWebhookUrl: typeof stored.teamsWebhookUrl === "string" ? stored.teamsWebhookUrl : null,
        emailDigestTo:   typeof stored.emailDigestTo === "string" ? stored.emailDigestTo : null,
        severityFloor:   (stored.severityFloor as Severity) ?? "low",
      };
    }
  } catch (err) {
    console.warn("[scanCompleteNotifier] prefs lookup failed:", err instanceof Error ? err.message : err);
  }
  return null;
}

async function postSlack(webhookUrl: string, body: { text: string; blocks?: unknown[] }): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn("[scanCompleteNotifier] slack post failed:", err instanceof Error ? err.message : err);
  }
}

async function postTeams(webhookUrl: string, body: { title: string; text: string }): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        themeColor: "0078D4",
        summary: body.title,
        title: body.title,
        text: body.text,
      }),
    });
  } catch (err) {
    console.warn("[scanCompleteNotifier] teams post failed:", err instanceof Error ? err.message : err);
  }
}

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

    // Per-tenant URLs from /dashboard/settings/notifications. Run in
    // parallel with the env-routed lane so the tenant can choose:
    // env-only, tenant-only, or both. severityFloor gates per-tenant
    // sends; the env-routed lane uses its own platform-level gating.
    const prefs = await loadTenantPrefs(input.tenantId);
    if (prefs) {
      const passesFloor =
        SEVERITY_ORDER[severity as Severity] >= SEVERITY_ORDER[prefs.severityFloor];
      if (passesFloor) {
        const text = `${headline}\n${lines.join("\n")}\nReview at https://visionxixlabs.com/dashboard/findings`;
        if (prefs.slackWebhookUrl) {
          void postSlack(prefs.slackWebhookUrl, { text });
        }
        if (prefs.teamsWebhookUrl) {
          void postTeams(prefs.teamsWebhookUrl, { title: headline, text });
        }
        // Email digest left as a TODO — the platform's email service
        // wiring is opinionated about sender/template and warrants
        // its own commit alongside the right SES/Resend integration.
      }
    }
  } catch (err) {
    console.warn(
      "[scanCompleteNotifier] send failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
