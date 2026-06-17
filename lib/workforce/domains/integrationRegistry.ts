/**
 * Workspace integration registry — Phase 644.
 *
 * Per-workspace storage for the integrations the action layer
 * uses to actually DO something with engineer outputs. Without
 * this, engineers produce reports; with this, engineers produce
 * reports AND fire real actions (open a GitHub issue, send a
 * Slack message, file a Linear ticket).
 *
 * Each integration kind has:
 *   · An enabled flag (pause without deleting)
 *   · Configuration fields specific to the integration
 *   · A credential reference — actual secret retrieval happens at
 *     action time. We never store the credential itself.
 *
 * Stored as a per-workspace singleton at targetKind=
 * workforce_integration_config, targetId=workspaceId. Same
 * singleton pattern as slack-config / monitoring-webhook / tickLog.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";

export const INTEGRATION_CONFIG_TARGET_KIND = "workforce_integration_config";

export interface GitHubIntegration {
  enabled: boolean;
  /** Repo in "owner/repo" format. */
  repo: string;
  /** Reference to where the PAT is stored. We accept either
   *  env://VAR_NAME (read from process.env at action time) or
   *  one of the secrets-manager prefixes (resolution is the
   *  customer's secrets-manager responsibility). */
  patReference: string;
  /** Label applied to every issue we open. */
  issueLabel: string;
}

export interface SlackActionIntegration {
  enabled: boolean;
  /** Distinct from the Phase 635 daily-digest webhook — this is
   *  for action notifications. Same hooks.slack.com SSRF guard. */
  webhookUrl: string;
}

export interface IntegrationConfig {
  github: GitHubIntegration | null;
  slackActions: SlackActionIntegration | null;
}

const EMPTY: IntegrationConfig = { github: null, slackActions: null };

/** Recognized credential reference prefixes. We don't try to
 *  resolve them here — the action executor calls a resolver that
 *  handles each prefix at action time. */
export function isValidCredentialReference(ref: string): boolean {
  if (typeof ref !== "string" || ref.length === 0 || ref.length > 400) return false;
  return /^(env|vault|secretsmanager|azurekeyvault|gcpsecretmanager):\/?\/?[\w\-/.]+$/i.test(ref);
}

export function isValidGithubRepo(repo: string): boolean {
  if (typeof repo !== "string" || repo.length === 0 || repo.length > 200) return false;
  // owner/repo — alphanumerics, hyphens, underscores, dots.
  return /^[\w.-]+\/[\w.-]+$/.test(repo);
}

export function isValidSlackWebhookUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0 || url.length > 400) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "hooks.slack.com" &&
      u.pathname.startsWith("/services/");
  } catch {
    return false;
  }
}

export async function readIntegrationConfig(
  organizationId: string,
): Promise<IntegrationConfig> {
  try {
    const row = await prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: INTEGRATION_CONFIG_TARGET_KIND,
          targetId: organizationId,
        },
      },
      select: { nextActionsJson: true },
    });
    if (!row || !Array.isArray(row.nextActionsJson)) return EMPTY;
    const tags = new Map<string, string>();
    for (const e of row.nextActionsJson as unknown[]) {
      if (typeof e !== "string") continue;
      const idx = e.indexOf("|");
      if (idx === -1) continue;
      tags.set(e.slice(0, idx), e.slice(idx + 1));
    }
    const github: GitHubIntegration | null = tags.get("github_enabled") !== undefined
      ? {
          enabled: tags.get("github_enabled") !== "false",
          repo: tags.get("github_repo") ?? "",
          patReference: tags.get("github_pat_reference") ?? "",
          issueLabel: tags.get("github_issue_label") ?? "axiom-finding",
        }
      : null;
    const slackActions: SlackActionIntegration | null = tags.get("slack_actions_enabled") !== undefined
      ? {
          enabled: tags.get("slack_actions_enabled") !== "false",
          webhookUrl: tags.get("slack_actions_webhook_url") ?? "",
        }
      : null;
    return { github, slackActions };
  } catch {
    return EMPTY;
  }
}

export async function writeIntegrationConfig(
  organizationId: string,
  config: IntegrationConfig,
): Promise<void> {
  const payload: string[] = [];
  if (config.github) {
    payload.push(`github_enabled|${config.github.enabled ? "true" : "false"}`);
    payload.push(`github_repo|${config.github.repo}`);
    payload.push(`github_pat_reference|${config.github.patReference}`);
    payload.push(`github_issue_label|${config.github.issueLabel}`);
  }
  if (config.slackActions) {
    payload.push(`slack_actions_enabled|${config.slackActions.enabled ? "true" : "false"}`);
    payload.push(`slack_actions_webhook_url|${config.slackActions.webhookUrl}`);
  }
  const enabledLines: string[] = [];
  if (config.github?.enabled) enabledLines.push(`github(${config.github.repo})`);
  if (config.slackActions?.enabled) enabledLines.push("slack");
  const narrative = `Integration config · ${enabledLines.length === 0 ? "none enabled" : enabledLines.join(" · ")}.`;

  await prisma.aiRationaleEnrichment.upsert({
    where: {
      organizationId_targetKind_targetId: {
        organizationId,
        targetKind: INTEGRATION_CONFIG_TARGET_KIND,
        targetId: organizationId,
      },
    },
    create: {
      organizationId,
      targetKind: INTEGRATION_CONFIG_TARGET_KIND,
      targetId: organizationId,
      narrative,
      riskFactorsJson: [] as unknown as string[],
      nextActionsJson: payload as unknown as string[],
      outcome: enabledLines.length > 0 ? "ai_generated" : "fallback_rules",
      errorMessage: null,
      modelHint: null,
      engineVersion: "integration-registry-v1",
    },
    update: {
      narrative,
      nextActionsJson: payload as unknown as string[],
    },
  });
}

/**
 * Resolve a credential reference into the actual secret at action
 * time. env:// is supported in-process; the other prefixes return
 * null and the caller surfaces a clear "secrets manager
 * integration not wired" error. Phase 647 wires vault and
 * secretsmanager via configurable resolvers.
 */
export function resolveCredentialReference(ref: string): string | null {
  if (!isValidCredentialReference(ref)) return null;
  if (ref.toLowerCase().startsWith("env://")) {
    const varName = ref.slice("env://".length).replace(/[^A-Z0-9_]/g, "");
    if (!varName) return null;
    const v = process.env[varName];
    return v && v.length > 0 ? v : null;
  }
  // vault:// / secretsmanager:// / azurekeyvault:// / gcpsecretmanager://
  // require external resolvers that aren't wired in this phase.
  return null;
}
