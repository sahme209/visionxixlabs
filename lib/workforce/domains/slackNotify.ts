/**
 * Slack webhook notification — Phase 635.
 *
 * The workforce daily-digest cron uses this helper to fire a single
 * Slack message when a workspace's 24h digest classifies as
 * "critical". The webhook URL is stored as an
 * AiRationaleEnrichment row at targetKind=workforce_slack_config,
 * targetId=workspaceId — same singleton-per-workspace pattern as
 * tickLog (no Prisma migration).
 *
 * Why the same pattern: keeps deployment lift to zero. Operator
 * configures one URL per workspace via a small form, the digest
 * cron reads it, posts, moves on.
 *
 * Failure policy: never throw. If Slack errors, the cron logs and
 * continues — a sick Slack webhook should never break the digest
 * pipeline.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";

export const SLACK_CONFIG_TARGET_KIND = "workforce_slack_config";

export interface SlackConfig {
  webhookUrl: string;
  /** Whether the operator wants notifications. Allows pausing without
   *  deleting the URL. */
  enabled: boolean;
  /** Minimum daily-digest outcome to notify on. "critical" by default. */
  minOutcome: "critical" | "active";
}

export async function readSlackConfig(organizationId: string): Promise<SlackConfig | null> {
  try {
    const row = await prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: SLACK_CONFIG_TARGET_KIND,
          targetId: organizationId,
        },
      },
      select: { nextActionsJson: true },
    });
    if (!row || !Array.isArray(row.nextActionsJson)) return null;
    const tags = new Map<string, string>();
    for (const e of row.nextActionsJson as unknown[]) {
      if (typeof e !== "string") continue;
      const idx = e.indexOf("|");
      if (idx === -1) continue;
      tags.set(e.slice(0, idx), e.slice(idx + 1));
    }
    const webhookUrl = tags.get("webhook_url");
    if (!webhookUrl) return null;
    return {
      webhookUrl,
      enabled: tags.get("enabled") !== "false",
      minOutcome: tags.get("min_outcome") === "active" ? "active" : "critical",
    };
  } catch {
    return null;
  }
}

export async function writeSlackConfig(
  organizationId: string,
  config: SlackConfig,
): Promise<void> {
  const payload: string[] = [
    `webhook_url|${config.webhookUrl}`,
    `enabled|${config.enabled ? "true" : "false"}`,
    `min_outcome|${config.minOutcome}`,
  ];
  await prisma.aiRationaleEnrichment.upsert({
    where: {
      organizationId_targetKind_targetId: {
        organizationId,
        targetKind: SLACK_CONFIG_TARGET_KIND,
        targetId: organizationId,
      },
    },
    create: {
      organizationId,
      targetKind: SLACK_CONFIG_TARGET_KIND,
      targetId: organizationId,
      narrative: `Slack notifications: ${config.enabled ? "enabled" : "paused"}, threshold ${config.minOutcome}.`,
      riskFactorsJson: [] as unknown as string[],
      nextActionsJson: payload as unknown as string[],
      outcome: "ai_generated",
      errorMessage: null,
      modelHint: null,
      engineVersion: "slack-config-v1",
    },
    update: {
      narrative: `Slack notifications: ${config.enabled ? "enabled" : "paused"}, threshold ${config.minOutcome}.`,
      nextActionsJson: payload as unknown as string[],
    },
  });
}

export async function deleteSlackConfig(organizationId: string): Promise<void> {
  try {
    await prisma.aiRationaleEnrichment.delete({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: SLACK_CONFIG_TARGET_KIND,
          targetId: organizationId,
        },
      },
    });
  } catch {
    // Row doesn't exist — that's the desired state, no-op.
  }
}

/**
 * Validate that a webhook URL looks like a Slack incoming-webhook URL.
 * Slack URLs are https://hooks.slack.com/services/T*/B*/* — we
 * accept that shape and reject anything else to prevent SSRF.
 */
export function isValidSlackWebhookUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "hooks.slack.com") return false;
    if (!parsed.pathname.startsWith("/services/")) return false;
    return true;
  } catch {
    return false;
  }
}

export interface NotifyResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

/**
 * POST a single Slack message. Never throws. Returns a structured
 * result so callers can audit/log without try/catch ceremony.
 */
export async function postSlackMessage(
  config: SlackConfig,
  text: string,
  fallbackTitle: string,
): Promise<NotifyResult> {
  if (!config.enabled) return { ok: true, status: 0, error: "disabled" };
  if (!isValidSlackWebhookUrl(config.webhookUrl)) {
    return { ok: false, status: null, error: "invalid_url" };
  }
  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: fallbackTitle,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: fallbackTitle, emoji: true },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: text.slice(0, 2900) },
          },
        ],
      }),
      // Slack incoming webhooks should respond quickly; cap at 8s.
      signal: AbortSignal.timeout(8_000),
    });
    return { ok: res.ok, status: res.status, error: res.ok ? null : `http_${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return { ok: false, status: null, error: msg.slice(0, 120) };
  }
}
